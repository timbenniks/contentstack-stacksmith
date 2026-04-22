import { resolve } from "node:path";

import { expect } from "chai";
import { runCommand } from "@oclif/test";

describe("stacksmith:build", () => {
  it("builds the example project", async () => {
    const pluginRoot = resolve(__dirname, "../..");
    const exampleRoot = resolve(pluginRoot, "../../apps/example-project");
    const result = await runCommand(
      [
        "stacksmith:build",
        "--cwd",
        exampleRoot,
        "--config",
        "contentstack.stacksmith.config.ts",
      ],
      { root: pluginRoot },
    );

    expect(result.error).to.equal(undefined);
    expect(result.stdout).to.contain("Built schema");
  });
});
