import { resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

import { createJsonResponse, installCommandRuntimeMocks, restoreCommandRuntimeMocks } from "../helpers/command-runtime";

describe("stacksmith:promote", () => {
  const pluginRoot = resolve(__dirname, "../..");
  const exampleRoot = resolve(pluginRoot, "../../apps/example-project");
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    installCommandRuntimeMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreCommandRuntimeMocks();
  });

  it("promotes local models into an empty target stack", async () => {
    const calls: Array<{ url: string; method: string }> = [];

    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });

      if (url.includes("/v3/content_types?")) {
        return createJsonResponse({ content_types: [], count: 0 });
      }

      if (url.includes("/v3/global_fields?")) {
        return createJsonResponse({ global_fields: [], count: 0 });
      }

      if (method === "POST" && url.includes("/v3/content_types")) {
        return createJsonResponse({ ok: true });
      }

      if (method === "POST" && url.includes("/v3/global_fields")) {
        return createJsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof fetch;

    const result = await runCommand(
      [
        "stacksmith:promote",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt-target",
        "--token-alias",
        "target-token",
        "--yes",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Promoted 3 change set(s) to target stack.");
    expect(calls.filter((call) => call.method === "GET")).to.have.lengthOf(2);
    expect(calls.filter((call) => call.method === "POST")).to.have.lengthOf(3);
  });

  it("does not mutate the target when --dry-run is set", async () => {
    const calls: Array<{ url: string; method: string }> = [];

    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });

      if (url.includes("/v3/content_types?")) {
        return createJsonResponse({ content_types: [], count: 0 });
      }

      if (url.includes("/v3/global_fields?")) {
        return createJsonResponse({ global_fields: [], count: 0 });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof fetch;

    const result = await runCommand(
      [
        "stacksmith:promote",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt-target",
        "--token-alias",
        "target-token",
        "--dry-run",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Dry run: no changes promoted.");
    expect(calls.filter((call) => call.method === "POST")).to.have.lengthOf(0);
    expect(calls.filter((call) => call.method === "PUT")).to.have.lengthOf(0);
  });
});
