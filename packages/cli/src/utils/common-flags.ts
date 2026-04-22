import { flags, type FlagInput } from "@contentstack/cli-utilities";

export const automationFlags = {
  ci: flags.boolean({
    description: "Disable prompts and require non-interactive behavior.",
    default: false,
  }),
  json: flags.boolean({
    description: "Emit machine-readable JSON output.",
    default: false,
  }),
} satisfies FlagInput;

export const remoteFlags = {
  stack: flags.string({
    char: "s",
    description: "Stack API key used for remote compare and apply.",
  }),
  "token-alias": flags.string({
    char: "t",
    description: "Contentstack management token alias.",
  }),
  "management-token": flags.string({
    description: "Management token. Overrides --token-alias and any parent CLI session.",
  }),
  branch: flags.string({
    description: "Contentstack branch name.",
  }),
  region: flags.string({
    char: "r",
    description: "Contentstack region alias.",
  }),
} satisfies FlagInput;

export const buildFlags = {
  config: flags.string({
    description: "Path to contentstack.stacksmith.config.ts",
  }),
  cwd: flags.string({
    description: "Working directory for resolving project files.",
  }),
  "out-dir": flags.string({
    description: "Override the config output directory for generated artifacts.",
  }),
} satisfies FlagInput;
