import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { ApplyService, StaleApplyStateError } from "../../services/apply-service.js";
import { BuildService } from "../../services/build-service.js";
import { PlanService } from "../../services/plan-service.js";
import { PromptService } from "../../prompts/prompt-service.js";
import { RemoteSnapshotService } from "../../services/remote-snapshot-service.js";
import { automationFlags, buildFlags, remoteFlags } from "../../utils/common-flags.js";
import { ensureParentCliRuntimeContext } from "../../utils/parent-cli-context.js";

export default class ModelsApply extends Command {
  static description = "Safely apply low-risk additive model changes to a Contentstack stack.";

  static examples = [
    "$ csdx stacksmith:apply --stack blt123 --token-alias my-stack",
    "$ csdx stacksmith:apply --stack blt123 --token-alias my-stack --yes --ci",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    ...remoteFlags,
    yes: flags.boolean({
      char: "y",
      description: "Skip confirmation after validations pass.",
      default: false,
    }),
    "dry-run": flags.boolean({
      description: "Print the plan and exit without contacting the stack.",
      default: false,
    }),
    "reset-state": flags.boolean({
      description: "Discard any existing apply-state.json before running.",
      default: false,
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsApply);
    if (!flags.stack) {
      this.error("--stack is required for apply.", { exit: 1 });
    }

    let runtime;
    try {
      runtime = await ensureParentCliRuntimeContext(this, {
        flagToken: flags["management-token"],
        tokenAlias: flags["token-alias"],
        ci: Boolean(flags.ci),
        purpose: "apply",
      });
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }

    const buildService = new BuildService();
    const remoteSnapshotService = new RemoteSnapshotService();
    const planService = new PlanService();
    const applyService = new ApplyService();
    const promptService = new PromptService();
    const formatter = new OutputFormatterService();

    const build = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });
    const remote = await remoteSnapshotService.load({
      stackApiKey: flags.stack,
      managementToken: runtime.managementToken,
      cmaBaseUrl: runtime.cmaBaseUrl,
      branch: flags.branch,
    });
    const plan = planService.create(build.schema, remote);

    if (plan.summary.blocked > 0) {
      this.log(formatter.formatPlan(plan));
      this.error("Apply aborted because the plan contains blocked changes.", { exit: 1 });
    }

    this.log(formatter.formatRemoteRuntimeContext(runtime));
    this.log("");
    this.log(formatter.formatPlan(plan));

    if (flags["dry-run"]) {
      if (flags.json) {
        this.log(formatter.formatJson({ dryRun: true, plan }));
      } else {
        this.log("");
        this.log("Dry run: no changes applied.");
      }
      return;
    }

    const confirmed = await promptService.confirm("Apply this low-risk plan?", {
      ci: flags.ci,
      yes: flags.yes,
    });

    if (!confirmed) {
      this.log("Apply cancelled.");
      return;
    }

    let result;
    try {
      result = await applyService.apply(
        plan,
        build.schema,
        {
          stackApiKey: flags.stack,
          managementToken: runtime.managementToken,
          cmaBaseUrl: runtime.cmaBaseUrl,
          branch: flags.branch,
        },
        { outDir: build.outDir, resetState: flags["reset-state"] },
      );
    } catch (error) {
      if (error instanceof StaleApplyStateError) {
        this.error(error.message, { exit: 1 });
      }
      throw error;
    }

    if (flags.json) {
      this.log(formatter.formatJson(result));
    } else {
      if (result.skipped.length > 0) {
        this.log(`Skipped ${result.skipped.length} operation(s) already applied in a previous run.`);
      }
      this.log(`Applied ${result.applied.length - result.skipped.length} remote change set(s).`);

      if (result.failed.length > 0) {
        this.log("");
        this.warn(`${result.failed.length} operation(s) failed:`);
        for (const failure of result.failed) {
          this.log(`  - ${failure.operationId}: ${failure.error}`);
        }
        if (result.stateFilePath) {
          this.log(`\nState file written to ${result.stateFilePath}`);
          this.log("Re-run apply to retry the remaining operations. Use --reset-state to discard state and start over.");
        }
      }
    }

    if (result.failed.length > 0) {
      this.exit(1);
    }
  }
}
