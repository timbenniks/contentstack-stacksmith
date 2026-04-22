import { Command } from "@contentstack/cli-command";
import type { FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { BuildService } from "../../services/build-service.js";
import { automationFlags, buildFlags } from "../../utils/common-flags.js";

export default class ModelsBuild extends Command {
  static description = "Compile TypeScript model definitions into normalized schema artifacts.";

  static examples = [
    "$ csdx stacksmith:build",
    "$ csdx stacksmith:build --config ./contentstack.stacksmith.config.ts --json",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsBuild);
    const buildService = new BuildService();
    const formatter = new OutputFormatterService();
    const result = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });

    this.log(flags.json ? formatter.formatJson(result) : formatter.formatBuild(result));

    if (result.findings.some((finding) => finding.level === "blocker")) {
      this.error("Build completed with blocking validation findings.", { exit: 1 });
    }
  }
}
