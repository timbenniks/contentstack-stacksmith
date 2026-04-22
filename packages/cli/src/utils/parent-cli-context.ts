import type { Command } from "@contentstack/cli-command";
import type { Region } from "@contentstack/cli-command/lib/interfaces/index.js";

import { PromptService } from "../prompts/prompt-service.js";
import { resolveToken, type ResolvedToken, type ResolveTokenOptions } from "./token.js";

export interface ParentCliRuntimeContext {
  region: Region;
  regionName: string;
  cmaHost: string;
  cdaHost: string;
  cmaBaseUrl: string;
  cdaBaseUrl: string;
  uiHost: string;
  context: unknown;
  tokenAlias?: string | undefined;
  managementToken: ResolvedToken;
}

export const resolveParentCliRuntimeContext = (
  command: Command,
  options: ResolveTokenOptions = {},
): ParentCliRuntimeContext => ({
  region: command.region,
  regionName: command.region.name,
  cmaHost: command.cmaHost,
  cdaHost: command.cdaHost,
  cmaBaseUrl: command.cmaAPIUrl,
  cdaBaseUrl: command.cdaAPIUrl,
  uiHost: command.uiHost,
  context: command.context,
  tokenAlias: options.tokenAlias,
  managementToken: resolveToken(command, options),
});

export interface EnsureTokenOptions extends ResolveTokenOptions {
  ci: boolean;
  prompt?: PromptService;
  purpose?: string;
}

const CI_GUIDANCE = [
  "No Contentstack credentials found. For CI, pass one of:",
  "  --management-token <token>",
  "  --token-alias <alias>                 (run: csdx auth:tokens:add)",
  "  CS_AUTHTOKEN=<token>                  (environment variable)",
  "  CONTENTSTACK_MANAGEMENT_TOKEN=<token> (environment variable)",
  "",
  "For interactive use, run one of:",
  "  csdx auth:login",
  "  csdx auth:login --oauth",
].join("\n");

/**
 * Resolve a runtime context, and if the token is missing, either interactively prompt
 * (TTY + not --ci) or throw a descriptive error. Use this from command classes that
 * need a token; it centralizes the prompt-or-fail decision.
 */
export const ensureParentCliRuntimeContext = async (
  command: Command,
  options: EnsureTokenOptions,
): Promise<ParentCliRuntimeContext> => {
  const runtime = resolveParentCliRuntimeContext(command, options);
  if (runtime.managementToken.source !== "missing" && runtime.managementToken.token) {
    return runtime;
  }

  if (options.ci) {
    throw new Error(CI_GUIDANCE);
  }

  if (!process.stdin.isTTY) {
    throw new Error(CI_GUIDANCE);
  }

  const prompt = options.prompt ?? new PromptService();
  const message = options.purpose
    ? `Enter a Contentstack management token for ${options.purpose}`
    : "Enter a Contentstack management token";
  const token = await prompt.promptForToken(message);
  if (!token) {
    throw new Error("No token entered. Aborting.");
  }

  return {
    ...runtime,
    managementToken: { token, kind: "management", source: "prompt" },
  };
};
