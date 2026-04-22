import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const createTempDir = (prefix = "contentstack-stacksmith-"): string => mkdtempSync(join(tmpdir(), prefix));

export const cleanupTempDir = (directory: string): void => {
  rmSync(directory, { recursive: true, force: true });
};
