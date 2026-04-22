import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { BuildService } from "../../services/build-service.js";
import { PlanService } from "../../services/plan-service.js";
import { RemoteSnapshotService } from "../../services/remote-snapshot-service.js";
import { automationFlags, buildFlags, remoteFlags } from "../../utils/common-flags.js";
import { ensureParentCliRuntimeContext } from "../../utils/parent-cli-context.js";
import { validateRemoteCompareFlags } from "../../utils/remote-command.js";

export default class ModelsPlan extends Command {
  static description = "Create a dependency-aware plan by comparing local models to a target stack.";

  static examples = [
    "$ csdx stacksmith:plan",
    "$ csdx stacksmith:plan --stack blt123 --token-alias my-stack --branch main",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    ...remoteFlags,
    output: flags.string({
      description: "Write the plan JSON to a specific file.",
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsPlan);
    const buildService = new BuildService();
    const remoteSnapshotService = new RemoteSnapshotService();
    const planService = new PlanService();
    const formatter = new OutputFormatterService();
    const build = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });
    const remoteFlagError = validateRemoteCompareFlags("stacksmith:plan", flags);
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
          purpose: "plan",
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

    const plan = planService.create(build.schema, remote);

    const outputPath = flags.output ?? join(build.outDir, "plan.json");
    await writeFile(outputPath, formatter.formatJson(plan));

    if (flags.json) {
      this.log(formatter.formatJson(plan));
      return;
    }

    if (runtime) {
      this.log(formatter.formatRemoteRuntimeContext(runtime));
      this.log("");
    }

    this.log(formatter.formatPlan(plan));
  }
}
