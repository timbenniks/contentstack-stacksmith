import { readFileSync } from "node:fs";

export const readInstalledPackageVersion = (pkg: string, fallback = "unknown"): string => {
  try {
    const pkgPath = require.resolve(`${pkg}/package.json`);
    return (JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string }).version ?? fallback;
  } catch {
    return fallback;
  }
};
