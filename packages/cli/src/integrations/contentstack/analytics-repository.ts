import type { OrgUsageSnapshot, StackUsageRow } from "@timbenniks/contentstack-stacksmith";

import type { ResolvedToken, TokenKind } from "../../utils/token.js";

const buildAuthHeaders = (kind: TokenKind, token: string): Record<string, string> => {
  switch (kind) {
    case "management":
      // Management tokens do not authorize these app-host endpoints; included only for completeness.
      return { authorization: token };
    case "session":
      return { authtoken: token };
    case "oauth":
      return { authorization: `Bearer ${token}` };
  }
};

/**
 * Processors served by GET /analytics/v1/dashboard/data/processor/<name>.
 * Each entry pairs the server-side processor slug with the widget `chartType`
 * the server validates against. Single-count widgets use `status-view-trend`;
 * the per-stack table uses `stack`. The canonical uid is what we key the
 * `metrics` record by on the returned snapshot.
 */
interface ProcessorSpec {
  processor: string;
  chartType: "status-view-trend" | "stack";
  /** canonical uid in OrgUsageSnapshot.metrics; usually the processor slug normalized */
  metricUid?: string;
}

const ORG_PROCESSORS: readonly ProcessorSpec[] = [
  { processor: "stacks-count", chartType: "status-view-trend", metricUid: "stacks" },
  { processor: "entries", chartType: "status-view-trend", metricUid: "entries" },
  { processor: "assets", chartType: "status-view-trend", metricUid: "assets" },
  { processor: "content-types", chartType: "status-view-trend", metricUid: "content_types" },
  { processor: "environments", chartType: "status-view-trend", metricUid: "environments" },
  { processor: "users-count", chartType: "status-view-trend", metricUid: "users" },
  { processor: "global-fields", chartType: "status-view-trend", metricUid: "global_fields" },
  { processor: "branches", chartType: "status-view-trend", metricUid: "branches" },
  { processor: "saved_searches", chartType: "status-view-trend", metricUid: "saved_searches" },
  { processor: "taxonomies", chartType: "status-view-trend", metricUid: "taxonomies" },
  { processor: "webhooks", chartType: "status-view-trend", metricUid: "webhooks" },
  { processor: "api-requests-count", chartType: "status-view-trend", metricUid: "api_requests" },
  { processor: "bandwidth-count", chartType: "status-view-trend", metricUid: "bandwidth" },
];

const STACK_USAGE_PROCESSOR: ProcessorSpec = { processor: "stack-usage", chartType: "stack" };

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Strict integer coercion for usage-counter fields. Analytics processors
 * occasionally echo numeric-looking strings, so we accept both but drop
 * non-finite or negative values (they would distort headroom math).
 */
const num = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const dateRange = (days: number): { from: string; to: string } => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
};

export interface AnalyticsRepositoryOptions {
  appBaseUrl: string;
  auth: ResolvedToken;
  fetchImpl?: typeof globalThis.fetch;
}

export class AnalyticsRepository {
  private readonly appBaseUrl: string;
  private readonly auth: ResolvedToken;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: AnalyticsRepositoryOptions) {
    this.appBaseUrl = options.appBaseUrl;
    this.auth = options.auth;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * Fetch every CMS dashboard processor and assemble a single OrgUsageSnapshot.
   * Per-processor failures are captured into `errors[]` rather than thrown — the
   * analytics feature may be partially enabled or rate-limited, and the audit
   * must still return something useful in that case.
   */
  async fetchOrgUsageSnapshot(organizationUid: string): Promise<OrgUsageSnapshot> {
    const snapshot: OrgUsageSnapshot = { metrics: {}, stacks: [], errors: [] };
    const { from, to } = dateRange(30);

    const orgResults = await Promise.all(
      ORG_PROCESSORS.map(async (spec) => {
        try {
          const body = await this.getProcessor(spec, organizationUid, { from, to });
          return { spec, ok: true as const, body };
        } catch (error) {
          return { spec, ok: false as const, error };
        }
      }),
    );

    for (const result of orgResults) {
      const metricUid = result.spec.metricUid ?? result.spec.processor;
      if (result.ok) {
        const body = result.body as { usage?: unknown; limit?: unknown; format?: unknown };
        snapshot.metrics[metricUid] = {
          usage: num(body.usage),
          ...(body.limit !== undefined ? { limit: num(body.limit) } : {}),
          format: typeof body.format === "string" ? body.format : "number",
        };
      } else {
        const message = result.error instanceof Error ? result.error.message : String(result.error);
        snapshot.errors.push({ processor: result.spec.processor, status: statusFromError(result.error), message });
      }
    }

    try {
      const stackBody = await this.getProcessor(STACK_USAGE_PROCESSOR, organizationUid, { from, to });
      snapshot.stacks = parseStackUsage(stackBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      snapshot.errors.push({
        processor: STACK_USAGE_PROCESSOR.processor,
        status: statusFromError(error),
        message,
      });
    }

    return snapshot;
  }

  private async getProcessor(
    spec: ProcessorSpec,
    organizationUid: string,
    range: { from: string; to: string },
  ): Promise<unknown> {
    const url = new URL(`/analytics/v1/dashboard/data/processor/${spec.processor}`, this.appBaseUrl);
    url.searchParams.set("orgUid", organizationUid);
    url.searchParams.set("chartType", spec.chartType);
    url.searchParams.set("duration", "day");
    url.searchParams.set("from", range.from);
    url.searchParams.set("to", range.to);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      organization_uid: organizationUid,
      ...buildAuthHeaders(this.auth.kind, this.auth.token),
    };

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      const err = new AnalyticsRequestError(
        `${spec.processor} returned HTTP ${response.status}: ${text.slice(0, 240)}`,
        response.status,
      );
      throw err;
    }

    try {
      return await response.json();
    } catch {
      throw new AnalyticsRequestError(
        `${spec.processor} returned HTTP ${response.status} but the response body was not valid JSON.`,
        response.status,
      );
    }
  }
}

export class AnalyticsRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AnalyticsRequestError";
  }
}

const statusFromError = (error: unknown): number => {
  if (error instanceof AnalyticsRequestError) return error.status;
  return 0;
};

/**
 * Parse the `stack-usage` response. Shape observed in the fixture:
 *   { stackUsage: { columns: [...], data: Array<{ name, api_key, content_types, ... }> } }
 * We tolerate both that nested shape and a top-level `data` array defensively.
 */
const parseStackUsage = (body: unknown): StackUsageRow[] => {
  if (!body || typeof body !== "object") return [];
  const outer = body as { stackUsage?: { data?: unknown }; data?: unknown };
  const data = outer.stackUsage?.data ?? outer.data;
  if (!Array.isArray(data)) return [];

  const rows: StackUsageRow[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : "";
    const apiKey = typeof row.api_key === "string" ? row.api_key : "";
    // Skip the synthetic "sub_row" entries the UI uses for drill-downs.
    if (row.is_sub_row === true) continue;
    rows.push({
      name,
      apiKey,
      ...(typeof row.branch_name === "string" ? { branchName: row.branch_name } : {}),
      ...(typeof row.owner_email === "string" ? { ownerEmail: row.owner_email } : {}),
      contentTypes: num(row.content_types),
      globalFields: num(row.global_fields),
      entries: num(row.entries),
      assets: num(row.assets),
      environments: num(row.environments),
      locales: num(row.locales),
      extensions: num(row.extensions),
      webhooks: num(row.webhooks),
      roles: num(row.roles),
      branches: num(row.branches),
      taxonomies: num(row.taxonomies),
      savedSearches: num(row.saved_searches),
    });
  }
  return rows;
};
