export type RemoteFlagValues = Record<string, unknown> & {
  stack?: string | undefined;
  "token-alias"?: string | undefined;
  branch?: string | undefined;
  region?: string | undefined;
};

export const validateRemoteCompareFlags = (
  commandName: "stacksmith:diff" | "stacksmith:plan",
  flags: RemoteFlagValues,
): string | undefined => {
  if (flags.stack) {
    return undefined;
  }

  if (flags["token-alias"] || flags.branch || flags.region) {
    return `${commandName} requires --stack when using --token-alias, --branch, or --region.`;
  }

  return undefined;
};
