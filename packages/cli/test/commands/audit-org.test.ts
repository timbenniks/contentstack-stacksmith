import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

import { createJsonResponse, installCommandRuntimeMocks, restoreCommandRuntimeMocks } from "../helpers/command-runtime";

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
}

const FIXTURE_PATH = resolve(__dirname, "../fixtures/org-response.json");
const ANALYTICS_FIXTURE_PATH = resolve(__dirname, "../fixtures/analytics-response.json");

describe("stacksmith:audit-org", () => {
  const pluginRoot = resolve(__dirname, "../..");
  const exampleRoot = resolve(pluginRoot, "../../apps/example-project");
  const originalFetch = globalThis.fetch;

  // Session state snapshot/restore — tests mutate configHandler to simulate auth:login.
  let configSnapshot: Record<string, unknown> = {};

  const snapshotConfig = async (): Promise<void> => {
    const { configHandler } = await import("@contentstack/cli-utilities");
    for (const key of ["authorisationType", "authtoken", "oauthAccessToken", "oauthOrgUid"]) {
      configSnapshot[key] = configHandler.get(key);
      configHandler.delete(key);
    }
  };

  const restoreConfig = async (): Promise<void> => {
    const { configHandler } = await import("@contentstack/cli-utilities");
    for (const [key, value] of Object.entries(configSnapshot)) {
      if (value === undefined || value === null) {
        configHandler.delete(key);
      } else {
        configHandler.set(key, value);
      }
    }
    configSnapshot = {};
  };

  const setBasicSession = async (): Promise<void> => {
    const { configHandler } = await import("@contentstack/cli-utilities");
    configHandler.set("authorisationType", "BASIC");
    configHandler.set("authtoken", "session-xyz");
  };

  const setOAuthSession = async (opts: { orgUid?: string } = {}): Promise<void> => {
    const { configHandler } = await import("@contentstack/cli-utilities");
    configHandler.set("authorisationType", "OAUTH");
    configHandler.set("oauthAccessToken", "oauth-xyz");
    if (opts.orgUid) configHandler.set("oauthOrgUid", opts.orgUid);
  };

  beforeEach(async () => {
    installCommandRuntimeMocks();
    await snapshotConfig();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await restoreConfig();
    restoreCommandRuntimeMocks();
    delete process.env.CS_AUTHTOKEN;
    delete process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
  });

  const installFetchMock = (handler: (call: FetchCall) => Response | Promise<Response>): FetchCall[] => {
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const call: FetchCall = {
        url: String(input),
        method: init?.method ?? "GET",
        headers: (init?.headers ?? {}) as Record<string, string>,
      };
      calls.push(call);
      return handler(call);
    }) as typeof fetch;
    return calls;
  };

  const fixtureResponse = async (): Promise<unknown> => JSON.parse(await readFile(FIXTURE_PATH, "utf8"));

  it("rejects --management-token with a user-auth hint before any network call", async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("should not be called");
    }) as typeof fetch;

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--management-token", "x", "--ci"],
      { root: pluginRoot },
    );

    const message = result.error?.message ?? result.stderr;
    expect(message).to.match(/Management tokens are stack-scoped/);
    expect(fetchCalled).to.equal(false);
  });

  it("rejects --token-alias with a user-auth hint before any network call", async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("should not be called");
    }) as typeof fetch;

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--token-alias", "my-alias", "--ci"],
      { root: pluginRoot },
    );

    const message = result.error?.message ?? result.stderr;
    expect(message).to.match(/Management tokens are stack-scoped/);
    expect(fetchCalled).to.equal(false);
  });

  it("exits with the user-auth hint when no session is configured", async () => {
    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci"],
      { root: pluginRoot },
    );

    const message = result.error?.message ?? result.stderr;
    expect(message).to.match(/requires a user session/);
  });

  it("exits when no org UID can be resolved", async () => {
    await setBasicSession();

    const result = await runCommand(
      ["stacksmith:audit-org", "--ci"],
      { root: pluginRoot },
    );

    const message = result.error?.message ?? result.stderr;
    expect(message).to.match(/Could not determine the organization UID/);
  });

  it("runs a capabilities-only audit with a basic session and --org", async () => {
    await setBasicSession();
    const fixture = await fixtureResponse();

    const calls = installFetchMock(async () => createJsonResponse(fixture));

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(result.stdout).to.contain("Organization:");
    expect(result.stdout).to.contain("Plan: ");
    expect(result.stdout).to.contain("Summary:");

    // Assert the session header went out correctly.
    expect(calls).to.have.lengthOf(1);
    expect(calls[0]!.headers.authtoken).to.equal("session-xyz");
    expect(calls[0]!.headers.authorization).to.equal(undefined);
  });

  it("uses the OAuth Bearer header for OAuth sessions", async () => {
    await setOAuthSession({ orgUid: "blt-org-uid" });
    const fixture = await fixtureResponse();

    const calls = installFetchMock(async () => createJsonResponse(fixture));

    const result = await runCommand(
      ["stacksmith:audit-org", "--ci"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(calls[0]!.headers.authorization).to.equal("Bearer oauth-xyz");
    expect(calls[0]!.headers.authtoken).to.equal(undefined);
  });

  it("auto-derives the org UID from oauthOrgUid when --org is omitted", async () => {
    await setOAuthSession({ orgUid: "blt-from-oauth" });
    const fixture = await fixtureResponse();

    const calls = installFetchMock(async () => createJsonResponse(fixture));

    const result = await runCommand(
      ["stacksmith:audit-org", "--ci"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(calls[0]!.url).to.contain("/v3/organizations/blt-from-oauth");
  });

  it("derives the org UID from --stack when no session-stored UID is present", async () => {
    await setBasicSession();
    const fixture = await fixtureResponse();

    const calls = installFetchMock(async (call) => {
      if (call.url.includes("/v3/stacks/blt123abc")) {
        return createJsonResponse({ stack: { organization_uid: "blt-from-stack" } });
      }
      if (call.url.includes("/v3/organizations/blt-from-stack")) {
        return createJsonResponse(fixture);
      }
      throw new Error(`Unexpected fetch: ${call.url}`);
    });

    const result = await runCommand(
      ["stacksmith:audit-org", "--stack", "blt123abc", "--ci"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(calls.some((c) => c.url.includes("/v3/stacks/blt123abc"))).to.equal(true);
    expect(calls.some((c) => c.url.includes("/v3/organizations/blt-from-stack"))).to.equal(true);
  });

  it("cross-references local DSL and exits with blockers when the plan limit is exceeded", async () => {
    await setBasicSession();

    // Tweak the captured fixture so that content_types.limit is 0 — example-project defines 2 CTs,
    // so the check should fire.
    const fixture = await fixtureResponse() as {
      organization: { plan: { features: Array<{ uid: string; limit: number; max_limit: number; enabled: boolean }> } };
    };
    const contentTypesFeature = fixture.organization.plan.features.find((f) => f.uid === "content_types");
    if (!contentTypesFeature) {
      throw new Error("Fixture is missing `content_types` feature entry — refresh it via `pnpm run capture-org-fixture`.");
    }
    contentTypesFeature.limit = 0;
    contentTypesFeature.max_limit = 0;

    installFetchMock(async () => createJsonResponse(fixture));

    const result = await runCommand(
      [
        "stacksmith:audit-org",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--org",
        "blt-org-uid",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.stdout).to.contain("MAX_CONTENT_TYPES_EXCEEDED");
    expect(result.stdout).to.contain("Summary:");
    // exit code 1 surfaces as a non-undefined result.error
    expect(result.error).to.not.equal(undefined);
  });

  it("emits parseable JSON under --json without ANSI escapes", async () => {
    await setBasicSession();
    const fixture = await fixtureResponse();

    installFetchMock(async () => createJsonResponse(fixture));

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci", "--json"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    // Parseable-JSON on its own is a strong signal there's no ANSI framing.
    const parsed = JSON.parse(result.stdout);
    expect(parsed.organizationUid).to.equal("fixture-org-uid");
    expect(typeof parsed.plan.name).to.equal("string");
    expect(Array.isArray(parsed.findings)).to.equal(true);
    expect(typeof parsed.features).to.equal("object");
  });

  it("surfaces UNRECOGNIZED_PLAN_SHAPE when the response has no plan.features[]", async () => {
    await setBasicSession();
    installFetchMock(async () => createJsonResponse({ organization: { uid: "blt-org-uid", name: "Bare Org" } }));

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci", "--json"],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    const parsed = JSON.parse(result.stdout);
    const finding = parsed.findings.find((f: { code: string }) => f.code === "UNRECOGNIZED_PLAN_SHAPE");
    expect(finding).to.not.equal(undefined);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Analytics / usage integration. These tests pin the capture-analytics-fixture
  // shape against the real parsing + rule code, so any drift in the undocumented
  // /analytics/v1 processor endpoints shows up in CI rather than in production.
  // ───────────────────────────────────────────────────────────────────────────

  interface AnalyticsFixture {
    results: Array<{ processor: string; body: unknown }>;
  }

  /**
   * Build a URL-dispatching fetch mock that serves org-response.json for CMA
   * calls and the analytics fixture for /analytics/v1 processor calls.
   * The processor slug is the last path segment; uiHost isn't CMA, so the two
   * don't overlap.
   */
  const installOrgAndAnalyticsMocks = (
    orgBody: unknown,
    analytics: AnalyticsFixture,
  ): FetchCall[] => {
    const byProcessor = new Map<string, unknown>();
    for (const row of analytics.results) byProcessor.set(row.processor, row.body);

    return installFetchMock(async (call) => {
      if (call.url.includes("/analytics/v1/dashboard/data/processor/")) {
        const match = /\/processor\/([^?]+)/.exec(call.url);
        const processor = match ? match[1] : "";
        const body = byProcessor.get(processor ?? "");
        if (body === undefined) {
          return new Response(JSON.stringify({ error: "not in fixture" }), { status: 404 });
        }
        return createJsonResponse(body);
      }
      return createJsonResponse(orgBody);
    });
  };

  const analyticsFixtureResponse = async (): Promise<AnalyticsFixture> =>
    JSON.parse(await readFile(ANALYTICS_FIXTURE_PATH, "utf8")) as AnalyticsFixture;

  it("populates usage snapshot when --include-usage is passed", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse();
    const analytics = await analyticsFixtureResponse();

    const calls = installOrgAndAnalyticsMocks(orgFixture, analytics);

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--include-usage", "--ci", "--json"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.usage).to.not.equal(undefined);
    expect(parsed.usage.metrics).to.be.an("object");
    // The fixture has content_types.usage = 72 and limit = 1000.
    expect(parsed.usage.metrics.content_types.usage).to.equal(72);
    expect(parsed.usage.metrics.content_types.limit).to.equal(1000);
    expect(Array.isArray(parsed.usage.stacks)).to.equal(true);
    expect(parsed.usage.stacks.length).to.be.greaterThan(0);

    // Informational org-usage findings should be present for capacity-relevant metrics.
    const hasContentTypeFinding = parsed.findings.some(
      (f: { code: string }) => f.code === "ORG_USAGE_OK_CONTENT_TYPES" || f.code.startsWith("ORG_USAGE_"),
    );
    expect(hasContentTypeFinding).to.equal(true);

    // At least one call hit the analytics host path.
    const analyticsCalls = calls.filter((c) => c.url.includes("/analytics/v1/dashboard/data/processor/"));
    expect(analyticsCalls.length).to.be.greaterThan(0);
  });

  it("emits STACK_CAPACITY_EXCEEDED when the targeted stack has no headroom for the DSL additions", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse() as {
      organization: { plan: { features: Array<{ uid: string; limit: number; max_limit: number }> } };
    };
    // Keep the org-level content_types limit at 1000 (the fixture default).

    const analytics = await analyticsFixtureResponse();
    // Saturate the first stack's content_types to 999 so example-project's 2 CTs overflow.
    const stackUsageResult = analytics.results.find((r) => r.processor === "stack-usage");
    if (!stackUsageResult) throw new Error("analytics fixture missing stack-usage");
    const body = stackUsageResult.body as { stackUsage: { data: Array<{ api_key: string; content_types: number }> } };
    const firstRow = body.stackUsage.data[0];
    if (!firstRow) throw new Error("stack-usage fixture has no rows");
    const targetApiKey = firstRow.api_key;
    firstRow.content_types = 999;

    installOrgAndAnalyticsMocks(orgFixture, analytics);

    const result = await runCommand(
      [
        "stacksmith:audit-org",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--org",
        "blt-org-uid",
        "--stack",
        targetApiKey,
        "--include-usage",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.stdout).to.contain("STACK_CAPACITY_EXCEEDED_CONTENT_TYPES");
    // Blocker → non-undefined error.
    expect(result.error).to.not.equal(undefined);
  });

  it("degrades gracefully when analytics processors all return 500", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse();

    installFetchMock(async (call) => {
      if (call.url.includes("/analytics/v1/dashboard/data/processor/")) {
        return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
      }
      return createJsonResponse(orgFixture);
    });

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--include-usage", "--ci", "--json"],
      { root: pluginRoot },
    );

    // Audit should not fail just because analytics is unavailable.
    expect(result.error, result.error?.message).to.equal(undefined);
    const parsed = JSON.parse(result.stdout);
    const unavailable = parsed.findings.filter(
      (f: { code: string }) => f.code === "ANALYTICS_PROCESSOR_UNAVAILABLE",
    );
    expect(unavailable.length).to.be.greaterThan(0);
    // Cap: never more than 6 per-processor lines (5 + "…and N more").
    expect(unavailable.length).to.be.at.most(6);
  });

  it("collapses into a single ANALYTICS_DISABLED finding when every processor returns 403", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse();

    installFetchMock(async (call) => {
      if (call.url.includes("/analytics/v1/dashboard/data/processor/")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
      return createJsonResponse(orgFixture);
    });

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--include-usage", "--ci", "--json"],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    const parsed = JSON.parse(result.stdout);
    const disabled = parsed.findings.filter((f: { code: string }) => f.code === "ANALYTICS_DISABLED");
    expect(disabled.length).to.equal(1);
    // The noisy per-processor notes must NOT be emitted when the whole subsystem is disabled.
    const noise = parsed.findings.filter((f: { code: string }) => f.code === "ANALYTICS_PROCESSOR_UNAVAILABLE");
    expect(noise.length).to.equal(0);
    // Role-hint language should be present so the user knows what to ask support for.
    expect(disabled[0].message).to.match(/role|admin|owner/i);
  });

  it("writes a Markdown report when --output is passed with a .md path", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse();
    installFetchMock(async () => createJsonResponse(orgFixture));

    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "audit-org-"));
    const outputPath = join(dir, "report.md");

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci", "--output", outputPath],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(result.stdout).to.contain("Wrote audit report to");

    const { readFile: read } = await import("node:fs/promises");
    const body = await read(outputPath, "utf8");
    expect(body).to.contain("# Contentstack Organization Audit Report");
    expect(body).to.contain("## Plan features");
    expect(body).to.contain("Generated by `csdx stacksmith:audit-org`");
  });

  it("writes a JSON report when --output path has a .json extension", async () => {
    await setBasicSession();
    const orgFixture = await fixtureResponse();
    installFetchMock(async () => createJsonResponse(orgFixture));

    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "audit-org-"));
    const outputPath = join(dir, "report.json");

    const result = await runCommand(
      ["stacksmith:audit-org", "--org", "blt-org-uid", "--ci", "--output", outputPath],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    const { readFile: read } = await import("node:fs/promises");
    const body = await read(outputPath, "utf8");
    const parsed = JSON.parse(body);
    expect(parsed.organizationUid).to.equal("fixture-org-uid");
    expect(Array.isArray(parsed.findings)).to.equal(true);
  });
});
