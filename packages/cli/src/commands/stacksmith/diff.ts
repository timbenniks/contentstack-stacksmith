import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "@contentstack/cli-command";
import type { FlagInput } from "@contentstack/cli-utilities";
import { flags } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { BuildService } from "../../services/build-service.js";
import { DiffService } from "../../services/diff-service.js";
import { RemoteSnapshotService } from "../../services/remote-snapshot-service.js";
import { automationFlags, buildFlags, remoteFlags } from "../../utils/common-flags.js";
import { ensureParentCliRuntimeContext } from "../../utils/parent-cli-context.js";
import { validateRemoteCompareFlags } from "../../utils/remote-command.js";

export default class ModelsDiff extends Command {
  static description = "Show a human-readable or JSON diff between local models and a target stack.";

  static examples = [
    "$ csdx stacksmith:diff",
    "$ csdx stacksmith:diff --stack blt123 --token-alias my-stack --json",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    ...remoteFlags,
    output: flags.string({
      description: "Write the diff JSON to a specific file.",
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsDiff);
    const buildService = new BuildService();
    const remoteSnapshotService = new RemoteSnapshotService();
    const diffService = new DiffService();
    const formatter = new OutputFormatterService();
    const build = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });
    const remoteFlagError = validateRemoteCompareFlags("stacksmith:diff", flags);
    if (remoteFlagError) {
      this.error(remoteFlagError, { exit: 1 });
    }

    const remoteMode = Boolean(flags.stack);
    let runtime;
    if (remoteMode) {
      try {
        runtime = await ensureParentCliRuntimeContext(this, {
          flagToken: flags["management-token"],
          tokenAlias: flags["token-alias"],
          ci: Boolean(flags.ci),
          purpose: "diff",
        });
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
      }
    }
    const remote = await remoteSnapshotService.load({
      stackApiKey: flags.stack,
      managementToken: runtime?.managementToken,
      cmaBaseUrl: runtime?.cmaBaseUrl,
      branch: flags.branch,
    });

    if (remoteMode && remote.entities.length === 0) {
      this.warn("Remote stack returned zero entities. All local models will appear as new.");
    }

    const diff = diffService.create(build.schema, remote);
    const outputPath = flags.output ?? join(build.outDir, "diff.json");

    await writeFile(outputPath, formatter.formatJson(diff));
    if (flags.json) {
      this.log(formatter.formatJson(diff));
      return;
    }

    if (runtime) {
      this.log(formatter.formatRemoteRuntimeContext(runtime));
      this.log("");
    }

    this.log(formatter.formatDiff(diff));
  }
}
