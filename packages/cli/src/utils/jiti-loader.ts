import jiti from "jiti";

const resolveAlias = (pkg: string): string | undefined => {
  try {
    return require.resolve(pkg);
  } catch {
    return undefined;
  }
};

export const createCliJiti = (filename: string) =>
  jiti(filename, {
    interopDefault: true,
    alias: Object.fromEntries(
      ([
        ["@timbenniks/contentstack-stacksmith", "@timbenniks/contentstack-stacksmith"],
        ["@timbenniks/contentstack-stacksmith-dsl", "@timbenniks/contentstack-stacksmith"],
        ["@timbenniks/contentstack-stacksmith-core", "@timbenniks/contentstack-stacksmith"],
        ["@timbenniks/contentstack-stacksmith-validators", "@timbenniks/contentstack-stacksmith"],
        ["@timbenniks/contentstack-stacksmith-test-utils", "@timbenniks/contentstack-stacksmith-test-utils"],
        ["@timbenniks/contentstack-stacksmith-cli", "@timbenniks/contentstack-stacksmith-cli"],
      ] as const)
        .map(([alias, target]) => [alias, resolveAlias(target)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  });
