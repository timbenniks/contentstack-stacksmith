import { expect } from "chai";

import { ManagementClientFactory } from "../../lib/integrations/contentstack/management-client-factory";

const createMockFetch = (responses: Array<{ status: number; body?: any; headers?: Record<string, string> }>) => {
  let callIndex = 0;
  const calls: Array<{ url: string; init: any }> = [];

  const mockFetch = async (input: any, init?: any) => {
    calls.push({ url: String(input), init });
    const response = responses[callIndex++];
    if (!response) throw new Error("No more mock responses");

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: new Map(Object.entries(response.headers ?? {})),
      json: async () => response.body,
      text: async () => JSON.stringify(response.body ?? {}),
    } as unknown as Response;
  };

  return { mockFetch, calls };
};

describe("ManagementClientFactory", () => {
  const factory = new ManagementClientFactory();
  const options = {
    stackApiKey: "test-key",
    managementToken: "test-token",
    cmaBaseUrl: "https://api.contentstack.io",
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed JSON on successful request", async () => {
    const { mockFetch } = createMockFetch([{ status: 200, body: { content_types: [{ uid: "test" }] } }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);
    const result = await client.request<{ content_types: any[] }>("/v3/content_types");

    expect(result.content_types).to.have.lengthOf(1);
    expect(result.content_types[0].uid).to.equal("test");
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 429, headers: { "Retry-After": "0" } },
      { status: 200, body: { ok: true } },
    ]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);
    const result = await client.request<{ ok: boolean }>("/v3/test");

    expect(result.ok).to.equal(true);
    expect(calls).to.have.lengthOf(2);
  });

  it("retries on 500 and succeeds on retry", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 500, body: { error: "server error" } },
      { status: 200, body: { ok: true } },
    ]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);
    const result = await client.request<{ ok: boolean }>("/v3/test");

    expect(result.ok).to.equal(true);
    expect(calls).to.have.lengthOf(2);
  });

  it("throws after MAX_RETRIES exhausted", async () => {
    const { mockFetch } = createMockFetch([
      { status: 429, headers: { "Retry-After": "0" } },
      { status: 429, headers: { "Retry-After": "0" } },
      { status: 429, headers: { "Retry-After": "0" } },
      { status: 429, headers: { "Retry-After": "0" } },
    ]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);

    try {
      await client.request("/v3/test");
      expect.fail("Expected error");
    } catch (error: any) {
      expect(error.message).to.contain("429");
    }
  });

  it("does not retry on 400", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 400, body: { error: "bad request" } }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);

    try {
      await client.request("/v3/test");
      expect.fail("Expected error");
    } catch (error: any) {
      expect(error.message).to.contain("400");
      expect(calls).to.have.lengthOf(1);
    }
  });

  it("does not retry on 401", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 401, body: { error: "unauthorized" } }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create(options);

    try {
      await client.request("/v3/test");
      expect.fail("Expected error");
    } catch (error: any) {
      expect(error.message).to.contain("401");
      expect(calls).to.have.lengthOf(1);
    }
  });

  it("sends `authorization: <token>` for management-kind tokens", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 200, body: {} }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create({
      stackApiKey: "stk",
      managementToken: { token: "mgmt-xyz", kind: "management", source: "flag" },
      cmaBaseUrl: "https://api.contentstack.io",
    });
    await client.request("/v3/test");

    const headers = calls[0]!.init.headers;
    expect(headers.authorization).to.equal("mgmt-xyz");
    expect(headers.authtoken).to.equal(undefined);
  });

  it("sends `authtoken: <token>` (NOT authorization) for basic-session tokens", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 200, body: {} }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create({
      stackApiKey: "stk",
      managementToken: { token: "session-xyz", kind: "session", source: "cli-session" },
      cmaBaseUrl: "https://api.contentstack.io",
    });
    await client.request("/v3/test");

    const headers = calls[0]!.init.headers;
    expect(headers.authtoken).to.equal("session-xyz");
    expect(headers.authorization).to.equal(undefined);
  });

  it("sends `authorization: Bearer <token>` for OAuth tokens", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 200, body: {} }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create({
      stackApiKey: "stk",
      managementToken: { token: "oauth-xyz", kind: "oauth", source: "cli-oauth" },
      cmaBaseUrl: "https://api.contentstack.io",
    });
    await client.request("/v3/test");

    const headers = calls[0]!.init.headers;
    expect(headers.authorization).to.equal("Bearer oauth-xyz");
    expect(headers.authtoken).to.equal(undefined);
  });

  it("treats a raw string managementToken as management-kind (backwards compatibility)", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 200, body: {} }]);
    globalThis.fetch = mockFetch as any;

    const client = factory.create({
      stackApiKey: "stk",
      managementToken: "plain-raw-token",
      cmaBaseUrl: "https://api.contentstack.io",
    });
    await client.request("/v3/test");

    const headers = calls[0]!.init.headers;
    expect(headers.authorization).to.equal("plain-raw-token");
  });
});
