import { resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

describe("stacksmith:plan", () => {
  const pluginRoot = resolve(__dirname, "../..");
  const exampleRoot = resolve(pluginRoot, "../../apps/example-project");

  it("rejects remote-only flags when --stack is missing", async () => {
    const result = await runCommand(
      [
        "stacksmith:plan",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
        "--token-alias",
        "my-stack",
      ],
      { root: pluginRoot },
    );

    expect(result.error?.message ?? result.stderr).to.contain(
      "stacksmith:plan requires --stack when using --token-alias, --branch, or --region.",
    );
  });

  it("shows a local plan without remote flags", async () => {
    const result = await runCommand(
      [
        "stacksmith:plan",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Operations:");
  });
});
