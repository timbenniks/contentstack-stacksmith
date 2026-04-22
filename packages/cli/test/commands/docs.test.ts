import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

describe("stacksmith:docs", () => {
  const pluginRoot = resolve(__dirname, "../..");
  const exampleRoot = resolve(pluginRoot, "../../apps/example-project");

  const createTempDir = (): string => mkdtempSync(join(tmpdir(), "contentstack-stacksmith-docs-"));

  it("writes markdown docs by default", async () => {
    const tempDir = createTempDir();
    const outputPath = join(tempDir, "models.md");

    try {
      const result = await runCommand(
        [
          "stacksmith:docs",
          "--cwd",
          exampleRoot,
          "--config",
          "contentstack.stacksmith.config.ts",
          "--output",
          outputPath,
        ],
        { root: pluginRoot },
      );

      expect(result.error).to.equal(undefined);
      expect(readFileSync(outputPath, "utf-8")).to.contain("# contentstack-stacksmith-example-project");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes JSON docs when format is json", async () => {
    const tempDir = createTempDir();
    const outputPath = join(tempDir, "models.json");

    try {
      const result = await runCommand(
        [
          "stacksmith:docs",
          "--cwd",
          exampleRoot,
          "--config",
          "contentstack.stacksmith.config.ts",
          "--format",
          "json",
          "--output",
          outputPath,
        ],
        { root: pluginRoot },
      );

      expect(result.error).to.equal(undefined);

      const document = JSON.parse(readFileSync(outputPath, "utf-8")) as {
        projectName: string;
        summary: { contentTypes: number; globalFields: number };
      };

      expect(document.projectName).to.equal("contentstack-stacksmith-example-project");
      expect(document.summary.contentTypes).to.equal(2);
      expect(document.summary.globalFields).to.equal(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes HTML docs when format is html", async () => {
    const tempDir = createTempDir();
    const outputPath = join(tempDir, "models.html");

    try {
      const result = await runCommand(
        [
          "stacksmith:docs",
          "--cwd",
          exampleRoot,
          "--config",
          "contentstack.stacksmith.config.ts",
          "--format",
          "html",
          "--output",
          outputPath,
        ],
        { root: pluginRoot },
      );

      expect(result.error).to.equal(undefined);

      const html = readFileSync(outputPath, "utf-8");
      expect(html).to.contain("<!doctype html>");
      expect(html).to.contain("Content Model Documentation");
      expect(html).to.contain("Blog Post");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
