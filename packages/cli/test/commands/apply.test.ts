import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

import { createJsonResponse, installCommandRuntimeMocks, restoreCommandRuntimeMocks } from "../helpers/command-runtime";

describe("stacksmith:apply", () => {
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

  it("requires a stack flag", async () => {
    const result = await runCommand(["stacksmith:apply"], { root: pluginRoot });

    expect(result.error?.message ?? result.stderr).to.contain("--stack is required for apply.");
  });

  it("fails with the multi-source guidance when --ci is set and no token is available", async () => {
    // The runtime mock installs a basic-session authtoken via configHandler; strip it so we can
    // assert the no-token error path.
    const { configHandler } = await import("@contentstack/cli-utilities");
    const prior = {
      authorisationType: configHandler.get("authorisationType"),
      authtoken: configHandler.get("authtoken"),
      oauth: configHandler.get("oauthAccessToken"),
    };
    configHandler.delete("authorisationType");
    configHandler.delete("authtoken");
    configHandler.delete("oauthAccessToken");
    const priorEnv = process.env.CS_AUTHTOKEN;
    delete process.env.CS_AUTHTOKEN;

    try {
      const result = await runCommand(
        [
          "stacksmith:apply",
          "--cwd",
          exampleRoot,
          "--config",
          "contentstack.stacksmith.config.ts",
          "--stack",
          "blt123",
          "--ci",
        ],
        { root: pluginRoot },
      );

      const message = result.error?.message ?? result.stderr;
      expect(message).to.contain("No Contentstack credentials found");
      expect(message).to.contain("--management-token");
      expect(message).to.contain("--token-alias");
      expect(message).to.contain("CS_AUTHTOKEN");
    } finally {
      if (prior.authorisationType !== undefined && prior.authorisationType !== null) configHandler.set("authorisationType", prior.authorisationType);
      if (prior.authtoken !== undefined && prior.authtoken !== null) configHandler.set("authtoken", prior.authtoken);
      if (prior.oauth !== undefined && prior.oauth !== null) configHandler.set("oauthAccessToken", prior.oauth);
      if (priorEnv !== undefined) process.env.CS_AUTHTOKEN = priorEnv;
    }
  });

  it("resolves a token via --management-token flag without needing an alias", async () => {
    const calls: Array<{ url: string; method: string; auth: string | undefined; authtoken: string | undefined }> = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, method, auth: headers.authorization, authtoken: headers.authtoken });

      if (url.includes("/v3/content_types?")) return createJsonResponse({ content_types: [], count: 0 });
      if (url.includes("/v3/global_fields?")) return createJsonResponse({ global_fields: [], count: 0 });
      if (method === "POST") return createJsonResponse({ ok: true });
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof fetch;

    const result = await runCommand(
      [
        "stacksmith:apply",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt123",
        "--management-token",
        "flag-mgmt-token",
        "--yes",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    const requestCalls = calls.filter((c) => c.url.includes("/v3/"));
    expect(requestCalls.every((c) => c.auth === "flag-mgmt-token")).to.equal(true);
    expect(requestCalls.every((c) => c.authtoken === undefined)).to.equal(true);
  });

  it("applies a low-risk create plan against an empty stack", async () => {
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
        "stacksmith:apply",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt123",
        "--token-alias",
        "my-stack",
        "--yes",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Applied 3 remote change set(s).");
    expect(calls.filter((call) => call.method === "GET")).to.have.lengthOf(2);
    expect(calls.filter((call) => call.method === "POST")).to.have.lengthOf(3);
  });

  it("does not mutate the stack when --dry-run is set", async () => {
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
        "stacksmith:apply",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt123",
        "--token-alias",
        "my-stack",
        "--dry-run",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Dry run: no changes applied.");
    expect(calls.filter((call) => call.method === "POST")).to.have.lengthOf(0);
    expect(calls.filter((call) => call.method === "PUT")).to.have.lengthOf(0);
  });

  it("aborts with a clear error when apply-state.json has a stale schema hash", async () => {
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/v3/content_types?")) {
        return createJsonResponse({ content_types: [], count: 0 });
      }
      if (url.includes("/v3/global_fields?")) {
        return createJsonResponse({ global_fields: [], count: 0 });
      }
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof fetch;

    const stateDir = resolve(exampleRoot, ".contentstack", "models");
    await mkdir(stateDir, { recursive: true });
    const stateFile = resolve(stateDir, "apply-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        schemaHash: "deadbeef-not-the-real-hash",
        applied: ["create:content_type/foo"],
        failed: [],
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    );

    try {
      const result = await runCommand(
        [
          "stacksmith:apply",
          "--cwd",
          exampleRoot,
          "--config",
          "contentstack.stacksmith.config.ts",
          "--stack",
          "blt123",
          "--token-alias",
          "my-stack",
          "--yes",
          "--ci",
        ],
        { root: pluginRoot },
      );

      expect(result.error?.message ?? result.stderr).to.match(/schema has changed|stale|reset-state/i);
    } finally {
      await rm(stateFile, { force: true });
    }
  });

  it("proceeds when --reset-state clears a stale apply-state.json", async () => {
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

    const stateDir = resolve(exampleRoot, ".contentstack", "models");
    await mkdir(stateDir, { recursive: true });
    const stateFile = resolve(stateDir, "apply-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        schemaHash: "deadbeef-not-the-real-hash",
        applied: [],
        failed: [],
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    );

    const result = await runCommand(
      [
        "stacksmith:apply",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--stack",
        "blt123",
        "--token-alias",
        "my-stack",
        "--yes",
        "--ci",
        "--reset-state",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Applied 3 remote change set(s).");
    // The state file should be absent after a clean apply.
    let exists = true;
    try {
      await access(stateFile);
    } catch {
      exists = false;
    }
    expect(exists).to.equal(false);
    void calls;
  });

  it("shows help output", async () => {
    const result = await runCommand(["stacksmith:apply", "--help"], { root: pluginRoot });

    expect(result.stdout).to.contain("Safely apply low-risk");
  });
});
