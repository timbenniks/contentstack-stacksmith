import type { OrgAuditFinding, OrgUsageSnapshot, SchemaArtifact, StackUsageRow } from "@timbenniks/contentstack-stacksmith";

import { USAGE_CRITICAL_THRESHOLD, USAGE_HIGH_THRESHOLD, percentLabel, ratio } from "./audit-shared.js";

export interface UsageRuleContext {
  snapshot: OrgUsageSnapshot;
  localSchema?: SchemaArtifact | undefined;
  /** If set, stack-level findings focus on this api_key. Otherwise the whole org is surveyed. */
  targetStackApiKey?: string | undefined;
}

/**
 * Count content types + global fields defined in the local DSL so we can
 * compare "X new items after import" against current stack headroom.
 */
const countLocalArtifacts = (schema: SchemaArtifact | undefined): { contentTypes: number; globalFields: number } => {
  if (!schema) return { contentTypes: 0, globalFields: 0 };
  let contentTypes = 0;
  let globalFields = 0;
  for (const entity of schema.entities) {
    if (entity.kind === "content_type") contentTypes += 1;
    else if (entity.kind === "global_field") globalFields += 1;
  }
  return { contentTypes, globalFields };
};

const findStackRow = (stacks: StackUsageRow[], apiKey: string | undefined): StackUsageRow | undefined => {
  if (!apiKey) return undefined;
  return stacks.find((row) => row.apiKey === apiKey);
};

/**
 * Rollup each stack's rows into a single row when --stack is not specified.
 * Different branches of the same stack appear as separate rows; we sum the
 * per-branch counts to get the whole-stack usage. Useful for org-wide surveys.
 */
const collapseByStack = (stacks: StackUsageRow[]): StackUsageRow[] => {
  const out = new Map<string, StackUsageRow>();
  for (const row of stacks) {
    if (!row.apiKey) continue;
    const existing = out.get(row.apiKey);
    if (!existing) {
      out.set(row.apiKey, { ...row });
      continue;
    }
    existing.contentTypes = Math.max(existing.contentTypes, row.contentTypes);
    existing.globalFields = Math.max(existing.globalFields, row.globalFields);
    existing.entries += row.entries;
    existing.assets = Math.max(existing.assets, row.assets);
    existing.environments = Math.max(existing.environments, row.environments);
    existing.locales = Math.max(existing.locales, row.locales);
    existing.extensions = Math.max(existing.extensions, row.extensions);
    existing.webhooks = Math.max(existing.webhooks, row.webhooks);
    existing.roles = Math.max(existing.roles, row.roles);
    existing.branches = Math.max(existing.branches, row.branches);
    existing.taxonomies = Math.max(existing.taxonomies, row.taxonomies);
    existing.savedSearches = Math.max(existing.savedSearches, row.savedSearches);
  }
  return [...out.values()];
};

/**
 * Org-level usage findings. For each metric with a known limit, we emit:
 *   - low informational at <80% usage
 *   - medium "approaching limit" at 80–94%
 *   - high "near limit" at 95–99%
 *   - blocker at ≥100%
 *
 * Metrics without a server-side limit (`saved_searches`, `taxonomies`,
 * `webhooks` at least on some plans) are only surfaced as informational.
 */
const buildOrgMetricFindings = (snapshot: OrgUsageSnapshot): OrgAuditFinding[] => {
  const findings: OrgAuditFinding[] = [];
  for (const [uid, metric] of Object.entries(snapshot.metrics)) {
    const { usage, limit, format } = metric;
    // Bandwidth + api_requests are traffic metrics, not data-model capacity; they
    // distort the "can I import?" story and aren't actionable from this command.
    if (uid === "bandwidth" || uid === "api_requests") continue;

    if (limit === undefined || limit <= 0) {
      findings.push({
        level: "low",
        code: `ORG_USAGE_${uid.toUpperCase()}`,
        capability: `usage.${uid}`,
        message: `Organization uses ${formatCount(usage, format)} ${humanize(uid)} (no hard plan limit advertised).`,
        planValue: undefined,
        localValue: usage,
      });
      continue;
    }

    const r = ratio(usage, limit);
    const percent = percentLabel(r);

    if (r >= 1) {
      findings.push({
        level: "blocker",
        code: `ORG_USAGE_AT_LIMIT_${uid.toUpperCase()}`,
        capability: `usage.${uid}`,
        message: `Organization is at its ${humanize(uid)} plan limit: ${formatCount(usage, format)} of ${formatCount(limit, format)} used (${percent}). Adding more will fail.`,
        planValue: limit,
        localValue: usage,
        remediation: `Free up existing ${humanize(uid)} or upgrade the plan.`,
      });
    } else if (r >= USAGE_CRITICAL_THRESHOLD) {
      findings.push({
        level: "high",
        code: `ORG_USAGE_NEAR_LIMIT_${uid.toUpperCase()}`,
        capability: `usage.${uid}`,
        message: `Organization is near its ${humanize(uid)} plan limit: ${formatCount(usage, format)} of ${formatCount(limit, format)} used (${percent}).`,
        planValue: limit,
        localValue: usage,
      });
    } else if (r >= USAGE_HIGH_THRESHOLD) {
      findings.push({
        level: "medium",
        code: `ORG_USAGE_HIGH_${uid.toUpperCase()}`,
        capability: `usage.${uid}`,
        message: `Organization ${humanize(uid)} usage is high: ${formatCount(usage, format)} of ${formatCount(limit, format)} (${percent}).`,
        planValue: limit,
        localValue: usage,
      });
    } else {
      findings.push({
        level: "low",
        code: `ORG_USAGE_OK_${uid.toUpperCase()}`,
        capability: `usage.${uid}`,
        message: `Organization uses ${formatCount(usage, format)} of ${formatCount(limit, format)} ${humanize(uid)} (${percent}).`,
        planValue: limit,
        localValue: usage,
      });
    }
  }
  return findings;
};

interface StackCapacityCheck {
  name: string;
  plural: string;
  currentUsage: number;
  planLimit: number | undefined;
  /** Count of new items the local DSL would add on import. 0 disables the projection check. */
  localAdditions: number;
}

/**
 * For a single targeted stack, emit per-capability findings that answer
 * "will my import fit?". Only emitted when we have both a current stack
 * count and a known plan limit.
 */
const buildStackCapacityFindings = (
  row: StackUsageRow,
  snapshot: OrgUsageSnapshot,
  localSchema: SchemaArtifact | undefined,
): OrgAuditFinding[] => {
  const local = countLocalArtifacts(localSchema);
  const contentTypesLimit = snapshot.metrics["content_types"]?.limit;
  const globalFieldsLimit = snapshot.metrics["global_fields"]?.limit;

  const checks: StackCapacityCheck[] = [
    {
      name: "content_types",
      plural: "content types",
      currentUsage: row.contentTypes,
      planLimit: contentTypesLimit,
      localAdditions: local.contentTypes,
    },
    {
      name: "global_fields",
      plural: "global fields",
      currentUsage: row.globalFields,
      planLimit: globalFieldsLimit,
      localAdditions: local.globalFields,
    },
  ];

  const findings: OrgAuditFinding[] = [];
  for (const check of checks) {
    if (check.planLimit === undefined || check.planLimit <= 0) continue;
    const projected = check.currentUsage + check.localAdditions;
    const headroom = check.planLimit - check.currentUsage;

    if (projected > check.planLimit) {
      findings.push({
        level: "blocker",
        code: `STACK_CAPACITY_EXCEEDED_${check.name.toUpperCase()}`,
        capability: `stack_usage.${check.name}`,
        message: `Stack "${row.name}" (${row.apiKey}) has ${check.currentUsage}/${check.planLimit} ${check.plural}; importing ${check.localAdditions} more would exceed the plan limit by ${projected - check.planLimit}.`,
        planValue: check.planLimit,
        localValue: projected,
        remediation: `Delete unused ${check.plural} in the stack, split the import across multiple stacks, or upgrade the plan.`,
      });
    } else if (check.currentUsage >= check.planLimit) {
      findings.push({
        level: "blocker",
        code: `STACK_AT_CAPACITY_${check.name.toUpperCase()}`,
        capability: `stack_usage.${check.name}`,
        message: `Stack "${row.name}" (${row.apiKey}) is at its ${check.plural} limit: ${check.currentUsage}/${check.planLimit}. Creating new ${check.plural} will fail.`,
        planValue: check.planLimit,
        localValue: check.currentUsage,
      });
    } else if (check.localAdditions > 0 && headroom < check.localAdditions * 2) {
      findings.push({
        level: "medium",
        code: `STACK_CAPACITY_TIGHT_${check.name.toUpperCase()}`,
        capability: `stack_usage.${check.name}`,
        message: `Stack "${row.name}" (${row.apiKey}) has ${check.currentUsage}/${check.planLimit} ${check.plural} (${headroom} headroom); the local DSL adds ${check.localAdditions}.`,
        planValue: check.planLimit,
        localValue: projected,
      });
    } else {
      findings.push({
        level: "low",
        code: `STACK_CAPACITY_OK_${check.name.toUpperCase()}`,
        capability: `stack_usage.${check.name}`,
        message: `Stack "${row.name}" (${row.apiKey}) uses ${check.currentUsage}/${check.planLimit} ${check.plural}${check.localAdditions > 0 ? `; importing ${check.localAdditions} more fits with ${headroom - check.localAdditions} headroom remaining.` : "."}`,
        planValue: check.planLimit,
        localValue: check.currentUsage,
      });
    }
  }
  return findings;
};

/**
 * Org-wide stack roll-up (no --stack flag): identify the "fullest" stack per
 * capability to give users a glance at where capacity pressure is greatest.
 */
const buildOrgWideStackSurvey = (
  snapshot: OrgUsageSnapshot,
): OrgAuditFinding[] => {
  const collapsed = collapseByStack(snapshot.stacks);
  if (collapsed.length === 0) return [];

  const findings: OrgAuditFinding[] = [];
  const contentTypesLimit = snapshot.metrics["content_types"]?.limit;
  if (contentTypesLimit && contentTypesLimit > 0) {
    const fullest = collapsed.reduce<StackUsageRow | undefined>((best, row) => {
      if (!best) return row;
      return row.contentTypes > best.contentTypes ? row : best;
    }, undefined);
    if (fullest && fullest.contentTypes > 0) {
      const r = ratio(fullest.contentTypes, contentTypesLimit);
      findings.push({
        level: r >= USAGE_CRITICAL_THRESHOLD ? "high" : r >= USAGE_HIGH_THRESHOLD ? "medium" : "low",
        code: "ORG_FULLEST_STACK_CONTENT_TYPES",
        capability: "stack_usage.content_types",
        message: `Across ${collapsed.length} stack(s), the highest content-type usage is "${fullest.name}" (${fullest.apiKey}) with ${fullest.contentTypes}/${contentTypesLimit} (${percentLabel(r)}).`,
        planValue: contentTypesLimit,
        localValue: fullest.contentTypes,
      });
    }
  }
  return findings;
};

/**
 * Auth-denied statuses. When *every* processor fails with one of these, we treat
 * the whole subsystem as unavailable for this user/org (analytics is a paid
 * add-on that's not enabled by default) and collapse the 14 per-processor
 * findings into a single clear message. Any other mix (e.g. 2 worked, 12 failed
 * with 500) is a real partial outage and stays as per-processor notes.
 */
const ANALYTICS_ACCESS_DENIED_STATUSES = new Set([401, 403, 404]);

const classifyAnalyticsAvailability = (
  snapshot: OrgUsageSnapshot,
): "ok" | "disabled" | "partial" => {
  const errorCount = snapshot.errors.length;
  const metricCount = Object.keys(snapshot.metrics).length;
  if (errorCount === 0) return "ok";
  // No successful metrics and every error is an access-denied signal → treat as disabled.
  const allAccessDenied = snapshot.errors.every((e) => ANALYTICS_ACCESS_DENIED_STATUSES.has(e.status));
  if (metricCount === 0 && snapshot.stacks.length === 0 && allAccessDenied) return "disabled";
  return "partial";
};

const buildAnalyticsAvailabilityFindings = (
  snapshot: OrgUsageSnapshot,
  availability: "ok" | "disabled" | "partial",
): OrgAuditFinding[] => {
  if (availability === "ok") return [];

  if (availability === "disabled") {
    // One clear message instead of 14 noisy rows. Match the upstream status so
    // the user understands *why* the feature is off — often a role check.
    const exampleStatus = snapshot.errors[0]?.status ?? 0;
    const reason =
      exampleStatus === 401
        ? "Your session is not authenticated for the analytics host."
        : exampleStatus === 403
          ? "Your user role does not have access to CMS analytics (typically requires Organization Owner or Admin)."
          : exampleStatus === 404
            ? "The analytics subsystem is not enabled for this organization."
            : "Analytics appears to be unavailable for this organization.";
    return [
      {
        level: "low",
        code: "ANALYTICS_DISABLED",
        capability: "analytics",
        message: `CMS analytics is unavailable; usage cross-reference was skipped. ${reason} (HTTP ${exampleStatus || "n/a"}). The rest of the audit is unaffected. Ask Contentstack support or your Org Admin to enable analytics if you want these checks in future runs.`,
      },
    ];
  }

  // Partial outage: keep a per-processor breadcrumb but at "low" so it doesn't
  // drown the signal. Cap at 5 entries to keep the report readable.
  const findings: OrgAuditFinding[] = [];
  for (const error of snapshot.errors.slice(0, 5)) {
    findings.push({
      level: "low",
      code: "ANALYTICS_PROCESSOR_UNAVAILABLE",
      capability: `analytics.${error.processor}`,
      message: `Analytics processor ${error.processor} was unavailable (status ${error.status || "n/a"}): ${error.message.slice(0, 160)}.`,
    });
  }
  if (snapshot.errors.length > 5) {
    findings.push({
      level: "low",
      code: "ANALYTICS_PROCESSOR_UNAVAILABLE",
      capability: "analytics",
      message: `…and ${snapshot.errors.length - 5} additional analytics processor(s) unavailable.`,
    });
  }
  return findings;
};

export const buildUsageFindings = (ctx: UsageRuleContext): OrgAuditFinding[] => {
  const availability = classifyAnalyticsAvailability(ctx.snapshot);
  const findings: OrgAuditFinding[] = [];

  // Only emit metric + stack findings when analytics is at least partially working.
  if (availability !== "disabled") {
    findings.push(...buildOrgMetricFindings(ctx.snapshot));
  }

  findings.push(...buildAnalyticsAvailabilityFindings(ctx.snapshot, availability));

  if (availability === "disabled") {
    // No stack data to report on; the single ANALYTICS_DISABLED finding is the whole story.
    return findings;
  }

  const targeted = findStackRow(ctx.snapshot.stacks, ctx.targetStackApiKey);
  if (targeted) {
    findings.push(...buildStackCapacityFindings(targeted, ctx.snapshot, ctx.localSchema));
  } else if (ctx.targetStackApiKey && ctx.snapshot.stacks.length > 0) {
    findings.push({
      level: "medium",
      code: "TARGET_STACK_NOT_IN_ANALYTICS",
      capability: "stack_usage",
      message: `Stack ${ctx.targetStackApiKey} did not appear in the analytics stack-usage table. This can happen if the stack was just created or if analytics lags behind provisioning.`,
    });
  } else if (!ctx.targetStackApiKey) {
    findings.push(...buildOrgWideStackSurvey(ctx.snapshot));
  }

  return findings;
};

/**
 * Humanize the canonical metric uids we chose in analytics-repository.ts so
 * findings read naturally (e.g. "content_types" → "content types"). No
 * library call for this — the set is fixed and small.
 */
const humanize = (uid: string): string => {
  switch (uid) {
    case "stacks":
      return "stacks";
    case "entries":
      return "entries";
    case "assets":
      return "assets";
    case "content_types":
      return "content types";
    case "environments":
      return "environments";
    case "users":
      return "users";
    case "global_fields":
      return "global fields";
    case "branches":
      return "branches";
    case "saved_searches":
      return "saved searches";
    case "taxonomies":
      return "taxonomies";
    case "webhooks":
      return "webhooks";
    default:
      return uid.replaceAll("_", " ");
  }
};

const formatCount = (value: number, format: string): string => {
  if (format === "bytes") return formatBytes(value);
  return value.toLocaleString("en-US");
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};
