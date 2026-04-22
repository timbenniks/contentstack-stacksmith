import type { Command } from "@contentstack/cli-command";
import { configHandler } from "@contentstack/cli-utilities";

export type TokenKind = "management" | "session" | "oauth";

export type TokenSource =
  | "flag"
  | "token-alias"
  | "cli-session"
  | "cli-oauth"
  | "environment"
  | "prompt"
  | "missing";

export interface ResolvedToken {
  token: string;
  kind: TokenKind;
  source: TokenSource;
}

export interface ResolveTokenOptions {
  flagToken?: string | undefined;
  tokenAlias?: string | undefined;
}

const extractAliasToken = (command: Command, tokenAlias: string): string => {
  try {
    const tokenData = command.getToken(tokenAlias);
    if (typeof tokenData === "string") return tokenData;
    if (tokenData && typeof tokenData === "object") {
      const record = tokenData as { authtoken?: string; token?: string };
      return record.authtoken ?? record.token ?? "";
    }
    return "";
  } catch {
    return "";
  }
};

/**
 * Resolve a Contentstack auth token from the first available source, in priority order:
 *   1. --management-token flag (always treated as a management token)
 *   2. --token-alias (resolved via the parent CLI's getToken; treated as a management token)
 *   3. OAuth session from `csdx auth:login --oauth`
 *   4. Basic session from `csdx auth:login`
 *   5. CS_AUTHTOKEN / CONTENTSTACK_MANAGEMENT_TOKEN env var (treated as a management token)
 *   6. Otherwise: `{ source: "missing" }` — callers decide whether to prompt or fail.
 *
 * Interactive prompting is NOT performed here; callers (command classes) are responsible
 * for calling PromptService.promptForToken when appropriate (TTY + not --ci).
 */
export const resolveToken = (command: Command, options: ResolveTokenOptions = {}): ResolvedToken => {
  if (options.flagToken) {
    return { token: options.flagToken, kind: "management", source: "flag" };
  }

  if (options.tokenAlias) {
    const aliasToken = extractAliasToken(command, options.tokenAlias);
    if (aliasToken) {
      return { token: aliasToken, kind: "management", source: "token-alias" };
    }
    return { token: "", kind: "management", source: "missing" };
  }

  const authorisationType = configHandler.get("authorisationType");
  if (authorisationType === "OAUTH") {
    const oauthToken = configHandler.get("oauthAccessToken");
    if (oauthToken) {
      return { token: oauthToken, kind: "oauth", source: "cli-oauth" };
    }
  }
  if (authorisationType === "BASIC") {
    const sessionToken = configHandler.get("authtoken");
    if (sessionToken) {
      return { token: sessionToken, kind: "session", source: "cli-session" };
    }
  }

  const envToken = process.env.CS_AUTHTOKEN || process.env.CONTENTSTACK_MANAGEMENT_TOKEN || "";
  if (envToken) {
    return { token: envToken, kind: "management", source: "environment" };
  }

  return { token: "", kind: "management", source: "missing" };
};

/**
 * Legacy name — kept for backwards compatibility with any external callers of the
 * previous `resolveManagementTokenContext` export. Returns the same shape as `resolveToken`.
 */
export const resolveManagementTokenContext = (command: Command, tokenAlias?: string): ResolvedToken =>
  resolveToken(command, { tokenAlias });

export const resolveManagementToken = (command: Command, tokenAlias?: string): string =>
  resolveToken(command, { tokenAlias }).token;

/**
 * Resolve a user-authentication token (session or OAuth) ONLY. Used by commands that
 * hit org-level endpoints, where stack-scoped management tokens will 403.
 *
 * Ignores --management-token, --token-alias, and CS_AUTHTOKEN env vars (all management-kind).
 * Walks: OAuth session → Basic session. Returns `source: "missing"` when neither is present.
 */
export const resolveUserAuthToken = (): ResolvedToken => {
  const authorisationType = configHandler.get("authorisationType");
  if (authorisationType === "OAUTH") {
    const oauthToken = configHandler.get("oauthAccessToken");
    if (oauthToken) return { token: oauthToken, kind: "oauth", source: "cli-oauth" };
  }
  if (authorisationType === "BASIC") {
    const sessionToken = configHandler.get("authtoken");
    if (sessionToken) return { token: sessionToken, kind: "session", source: "cli-session" };
  }
  return { token: "", kind: "session", source: "missing" };
};
