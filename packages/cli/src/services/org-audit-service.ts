import type {
  OrgAuditFinding,
  OrgAuditReport,
  OrgAuditSummary,
  OrgUsageSnapshot,
  SchemaArtifact,
} from "@timbenniks/contentstack-stacksmith";

import { AnalyticsRepository } from "../integrations/contentstack/analytics-repository.js";
import { ManagementClientFactory, type ManagementClientOptions } from "../integrations/contentstack/management-client-factory.js";
import { OrganizationRepository } from "../integrations/contentstack/organization-repository.js";
import type { ResolvedToken } from "../utils/token.js";
import { buildUsageFindings } from "./org-usage-rules.js";
import { rules, type OrgPlanShape, type PlanFeature } from "./org-audit-rules.js";

export interface OrgAuditUsageOptions {
  /** Resolved session/oauth token. Management tokens don't authorize analytics endpoints. */
  auth: ResolvedToken;
  /** App host, e.g. https://eu-app.contentstack.com. Normally `this.uiHost` on the parent CLI. */
  appBaseUrl: string;
  /** If set, focus stack-usage findings on this api_key. Otherwise the audit reports org-wide. */
  targetStackApiKey?: string | undefined;
  /** Allow tests to inject a fetch; production passes globalThis.fetch. */
  fetchImpl?: typeof globalThis.fetch | undefined;
}

export interface OrgAuditInput {
  organizationUid: string;
  localSchema?: SchemaArtifact | undefined;
  remoteOptions: ManagementClientOptions;
  usageOptions?: OrgAuditUsageOptions | undefined;
}

interface ShapeExtractResult {
  shape: OrgPlanShape;
  organizationUid: string;
  organizationName: string;
  unrecognized: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const asArray = (value: unknown): unknown[] | undefined => (Array.isArray(value) ? value : undefined);

const toFeature = (entry: unknown): PlanFeature | undefined => {
  const record = asRecord(entry);
  if (!record) return undefined;
  if (typeof record.uid !== "string" || record.uid.length === 0) return undefined;
  return {
    uid: record.uid,
    name: typeof record.name === "string" ? record.name : undefined,
    enabled: record.enabled === true,
    limit: typeof record.limit === "number" && Number.isFinite(record.limit) ? record.limit : 0,
    max_limit: typeof record.max_limit === "number" && Number.isFinite(record.max_limit) ? record.max_limit : undefined,
  };
};

/**
 * Parse `organization.plan.features[]` into a `Record<uid, PlanFeature>`. Some
 * responses contain duplicate entries for the same uid (one canonical, one in a
 * `group_key`-tagged "custom" slot); first entry wins. Everything unknown is
 * ignored silently — rules only look up uids they care about.
 */
const extractShape = (raw: unknown): ShapeExtractResult => {
  const rootRecord = asRecord(raw);
  const organization = asRecord(rootRecord?.organization) ?? rootRecord ?? {};
  const plan = asRecord(organization.plan) ?? asRecord(rootRecord?.plan) ?? {};

  const features: Record<string, PlanFeature> = {};
  for (const entry of asArray(plan.features) ?? []) {
    const feature = toFeature(entry);
    if (!feature) continue;
    if (!features[feature.uid]) features[feature.uid] = feature;
  }

  const organizationUid = typeof organization.uid === "string" ? organization.uid : "";
  const organizationName = typeof organization.name === "string" ? organization.name : "";
  const planName = typeof plan.name === "string" ? plan.name : "unknown";
  const planId = typeof plan.plan_id === "string" ? plan.plan_id : "";

  const unrecognized = Object.keys(features).length === 0;

  return {
    shape: { name: planName, planId, features },
    organizationUid,
    organizationName,
    unrecognized,
  };
};

const summarize = (findings: OrgAuditFinding[]): OrgAuditSummary => {
  const blockers = findings.filter((f) => f.level === "blocker").length;
  const warnings = findings.filter((f) => f.level === "high" || f.level === "medium").length;
  const passes = findings.filter((f) => f.level === "low").length;
  return { total: findings.length, blockers, warnings, passes };
};

const toFeatureRecord = (features: Record<string, PlanFeature>): Record<string, { enabled: boolean; limit: number; max_limit?: number | undefined; name?: string | undefined }> => {
  const out: Record<string, { enabled: boolean; limit: number; max_limit?: number | undefined; name?: string | undefined }> = {};
  for (const [uid, feature] of Object.entries(features)) {
    out[uid] = {
      enabled: feature.enabled,
      limit: feature.limit,
      ...(feature.max_limit !== undefined ? { max_limit: feature.max_limit } : {}),
      ...(feature.name !== undefined ? { name: feature.name } : {}),
    };
  }
  return out;
};

export class OrgAuditServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgAuditServiceError";
  }
}

export class OrgAuditService {
  constructor(
    private readonly managementClientFactory = new ManagementClientFactory(),
  ) {}

  async audit(input: OrgAuditInput): Promise<OrgAuditReport> {
    const client = this.managementClientFactory.create(input.remoteOptions);
    const repository = new OrganizationRepository(client);

    let raw: unknown;
    try {
      raw = await repository.fetchWithPlan(input.organizationUid);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("401") || message.toLowerCase().includes("authentication failed")) {
        throw new OrgAuditServiceError(
          `Authentication failed while reading organization ${input.organizationUid}. Your session may have expired — run csdx auth:login again.`,
        );
      }
      if (message.includes("403") || message.toLowerCase().includes("authorization denied")) {
        throw new OrgAuditServiceError(
          `Authorization denied for organization ${input.organizationUid}. Your user may not have read access to this organization.`,
        );
      }
      if (message.includes("404")) {
        throw new OrgAuditServiceError(
          `Organization ${input.organizationUid} not found. Double-check the UID — it's not a stack API key; find it in the URL bar of the organization's page in the Contentstack UI.`,
        );
      }
      throw error;
    }

    const { shape, organizationUid, organizationName, unrecognized } = extractShape(raw);
    const findings: OrgAuditFinding[] = [];

    if (unrecognized) {
      findings.push({
        level: "medium",
        code: "UNRECOGNIZED_PLAN_SHAPE",
        capability: "plan_shape",
        message:
          "The organization response did not include any recognizable plan.features[]. Audit rules may be stale — the response shape may have changed. Please re-capture the fixture with `pnpm run capture-org-fixture <orgUid>` and update PLAN_KEYS.",
        planValue: undefined,
      });
    }

    for (const rule of rules) {
      const finding = rule(shape, input.localSchema);
      if (finding) findings.push(finding);
    }

    let usage: OrgUsageSnapshot | undefined;
    if (input.usageOptions) {
      const analytics = new AnalyticsRepository({
        appBaseUrl: input.usageOptions.appBaseUrl,
        auth: input.usageOptions.auth,
        ...(input.usageOptions.fetchImpl ? { fetchImpl: input.usageOptions.fetchImpl } : {}),
      });
      try {
        usage = await analytics.fetchOrgUsageSnapshot(organizationUid || input.organizationUid);
        findings.push(
          ...buildUsageFindings({
            snapshot: usage,
            localSchema: input.localSchema,
            targetStackApiKey: input.usageOptions.targetStackApiKey,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        findings.push({
          level: "low",
          code: "ANALYTICS_UNAVAILABLE",
          capability: "analytics",
          message: `Could not read CMS analytics: ${message}. Audit continues without usage cross-reference. This is expected if analytics is not enabled for your organization.`,
        });
      }
    }

    return {
      organizationUid: organizationUid || input.organizationUid,
      organizationName: organizationName || "",
      plan: { name: shape.name },
      features: toFeatureRecord(shape.features),
      findings,
      summary: summarize(findings),
      ...(usage ? { usage } : {}),
    };
  }
}
