import { expect } from "chai";

import { configHandler } from "@contentstack/cli-utilities";

import { resolveToken } from "../../src/utils/token";

type GetTokenFn = (alias: string) => unknown;

interface StubCommand {
  getToken: GetTokenFn;
}

describe("resolveToken", () => {
  const originalEnv = { ...process.env };
  const snapshotKeys = ["authorisationType", "authtoken", "oauthAccessToken"] as const;
  const snapshot: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of snapshotKeys) snapshot[key] = configHandler.get(key);
    for (const key of snapshotKeys) configHandler.delete(key);
    delete process.env.CS_AUTHTOKEN;
    delete process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
  });

  afterEach(() => {
    for (const key of snapshotKeys) {
      const value = snapshot[key];
      if (value === undefined || value === null) {
        configHandler.delete(key);
      } else {
        configHandler.set(key, value);
      }
    }
    process.env = { ...originalEnv };
  });

  const stubCommand = (getToken: GetTokenFn = () => ""): StubCommand => ({ getToken });

  it("returns a flag-sourced management token when --management-token is passed", () => {
    let getTokenCalls = 0;
    const command = stubCommand(() => {
      getTokenCalls++;
      return "wrong";
    });

    const resolved = resolveToken(command as never, { flagToken: "xyz" });

    expect(resolved.token).to.equal("xyz");
    expect(resolved.kind).to.equal("management");
    expect(resolved.source).to.equal("flag");
    expect(getTokenCalls).to.equal(0);
  });

  it("resolves via token alias when the alias returns a raw string", () => {
    const resolved = resolveToken(
      stubCommand((alias) => (alias === "my-alias" ? "cma-raw-token" : "")) as never,
      { tokenAlias: "my-alias" },
    );

    expect(resolved.token).to.equal("cma-raw-token");
    expect(resolved.kind).to.equal("management");
    expect(resolved.source).to.equal("token-alias");
  });

  it("resolves via token alias when the alias returns an object with .token", () => {
    const resolved = resolveToken(
      stubCommand((alias) => (alias === "delivery-alias" ? { token: "dlv-token", apiKey: "blt" } : "")) as never,
      { tokenAlias: "delivery-alias" },
    );

    expect(resolved.token).to.equal("dlv-token");
    expect(resolved.source).to.equal("token-alias");
  });

  it("resolves via OAuth session when authorisationType is OAUTH", () => {
    configHandler.set("authorisationType", "OAUTH");
    configHandler.set("oauthAccessToken", "oauth-xyz");

    const resolved = resolveToken(stubCommand() as never, {});

    expect(resolved.token).to.equal("oauth-xyz");
    expect(resolved.kind).to.equal("oauth");
    expect(resolved.source).to.equal("cli-oauth");
  });

  it("resolves via basic session when authorisationType is BASIC", () => {
    configHandler.set("authorisationType", "BASIC");
    configHandler.set("authtoken", "session-xyz");

    const resolved = resolveToken(stubCommand() as never, {});

    expect(resolved.token).to.equal("session-xyz");
    expect(resolved.kind).to.equal("session");
    expect(resolved.source).to.equal("cli-session");
  });

  it("falls through to environment variable CS_AUTHTOKEN", () => {
    process.env.CS_AUTHTOKEN = "env-token";

    const resolved = resolveToken(stubCommand() as never, {});

    expect(resolved.token).to.equal("env-token");
    expect(resolved.kind).to.equal("management");
    expect(resolved.source).to.equal("environment");
  });

  it("prefers an explicit flag over any other source", () => {
    configHandler.set("authorisationType", "OAUTH");
    configHandler.set("oauthAccessToken", "oauth-xyz");
    process.env.CS_AUTHTOKEN = "env-token";

    const resolved = resolveToken(
      stubCommand(() => "alias-token") as never,
      { flagToken: "flag-token", tokenAlias: "my-alias" },
    );

    expect(resolved.source).to.equal("flag");
    expect(resolved.token).to.equal("flag-token");
  });

  it("prefers a valid alias over cli sessions and env", () => {
    configHandler.set("authorisationType", "OAUTH");
    configHandler.set("oauthAccessToken", "oauth-xyz");
    process.env.CS_AUTHTOKEN = "env-token";

    const resolved = resolveToken(
      stubCommand((alias) => (alias === "my-alias" ? "alias-token" : "")) as never,
      { tokenAlias: "my-alias" },
    );

    expect(resolved.source).to.equal("token-alias");
    expect(resolved.token).to.equal("alias-token");
  });

  it("returns missing when the alias is present but getToken yields nothing (does not fall through to session)", () => {
    // A user who passed a specific alias expects that alias to be used; silently falling back to a
    // different account's session would be surprising. The resolver reports missing; the command layer
    // decides how to surface it.
    configHandler.set("authorisationType", "BASIC");
    configHandler.set("authtoken", "session-xyz");

    const resolved = resolveToken(
      stubCommand(() => "") as never,
      { tokenAlias: "missing-alias" },
    );

    expect(resolved.source).to.equal("missing");
  });

  it("returns missing when no source is configured", () => {
    const resolved = resolveToken(stubCommand() as never, {});
    expect(resolved.source).to.equal("missing");
    expect(resolved.token).to.equal("");
  });
});
