import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

import { installCommandRuntimeMocks, restoreCommandRuntimeMocks } from "../helpers/command-runtime";

describe("stacksmith:typegen", () => {
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

  it("generates types from local DSL without touching the network", async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("typegen should not call the network in local-DSL mode");
    }) as typeof fetch;

    const outDir = await mkdtemp(join(tmpdir(), "typegen-local-"));
    const outputPath = join(outDir, "contentstack.d.ts");

    const result = await runCommand(
      [
        "stacksmith:typegen",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--output",
        outputPath,
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error, result.error?.message).to.equal(undefined);
    expect(fetchCalled).to.equal(false);

    const generated = await readFile(outputPath, "utf8");
    expect(generated).to.match(/interface\s+BlogPost/);
    expect(generated).to.match(/interface\s+Author/);
  });

  it("errors when --api-type graphql is requested without --from-stack", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "typegen-graphql-"));
    const outputPath = join(outDir, "contentstack.d.ts");

    const result = await runCommand(
      [
        "stacksmith:typegen",
        "--cwd",
        exampleRoot,
        "--output",
        outputPath,
        "--api-type",
        "graphql",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error?.message ?? result.stderr).to.match(/GraphQL typegen requires --from-stack/);
  });

  it("errors when --from-stack is set without --token-alias", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "typegen-nostack-"));
    const outputPath = join(outDir, "contentstack.d.ts");

    const result = await runCommand(
      [
        "stacksmith:typegen",
        "--cwd",
        exampleRoot,
        "--output",
        outputPath,
        "--from-stack",
        "--ci",
      ],
      { root: pluginRoot },
    );

    expect(result.error?.message ?? result.stderr).to.match(/--token-alias is required/);
  });
});
