import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { ApplyService, StaleApplyStateError } from "../../services/apply-service.js";
import { BuildService } from "../../services/build-service.js";
import { PlanService } from "../../services/plan-service.js";
import { ProjectConfigService } from "../../services/project-config-service.js";
import { PromptService } from "../../prompts/prompt-service.js";
import { RemoteSnapshotService } from "../../services/remote-snapshot-service.js";
import { automationFlags, buildFlags } from "../../utils/common-flags.js";
import { ensureParentCliRuntimeContext } from "../../utils/parent-cli-context.js";

export default class ModelsPromote extends Command {
  static description = "Promote models from local or a source stack to a target stack.";

  static examples = [
    "$ csdx stacksmith:promote --stack blt_target --token-alias target-token",
    "$ csdx stacksmith:promote --source-stack blt_dev --source-token-alias dev-token --stack blt_staging --token-alias staging-token",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    "source-stack": flags.string({
      description: "Source stack API key. If omitted, local compiled models are used as source.",
    }),
    "source-token-alias": flags.string({
      description: "Management token alias for the source stack.",
    }),
    "source-management-token": flags.string({
      description: "Management token for the source stack. Overrides --source-token-alias.",
    }),
    "source-branch": flags.string({
      description: "Branch on the source stack.",
    }),
    stack: flags.string({
      char: "s",
      description: "Target stack API key.",
      required: true,
    }),
    "token-alias": flags.string({
      description: "Management token alias for the target stack.",
    }),
    "management-token": flags.string({
      description: "Management token for the target stack. Overrides --token-alias and any parent CLI session.",
    }),
    branch: flags.string({
      description: "Branch on the target stack.",
    }),
    yes: flags.boolean({
      char: "y",
      description: "Skip confirmation prompt.",
      default: false,
    }),
    "dry-run": flags.boolean({
      description: "Print the plan and exit without mutating the target stack.",
      default: false,
    }),
    "reset-state": flags.boolean({
      description: "Discard any existing apply-state.json before running.",
      default: false,
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsPromote);

    let targetRuntime;
    try {
      targetRuntime = await ensureParentCliRuntimeContext(this, {
        flagToken: flags["management-token"],
        tokenAlias: flags["token-alias"],
        ci: Boolean(flags.ci),
        purpose: "the target stack",
      });
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }

    const remoteSnapshotService = new RemoteSnapshotService();
    const planService = new PlanService();
    const applyService = new ApplyService();
    const promptService = new PromptService();
    const formatter = new OutputFormatterService();

    let sourceSchema;
    let outDir: string | undefined;

    if (flags["source-stack"]) {
      let sourceRuntime;
      try {
        sourceRuntime = await ensureParentCliRuntimeContext(this, {
          flagToken: flags["source-management-token"],
          tokenAlias: flags["source-token-alias"],
          ci: Boolean(flags.ci),
          purpose: "the source stack",
        });
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
      }

      this.log("Fetching source stack schema...");
      sourceSchema = await remoteSnapshotService.load({
        stackApiKey: flags["source-stack"],
        managementToken: sourceRuntime.managementToken,
        cmaBaseUrl: sourceRuntime.cmaBaseUrl,
        branch: flags["source-branch"],
      });
    } else {
      this.log("Building local models as source...");
      const buildService = new BuildService();
      const build = await buildService.build({
        cwd: flags.cwd,
        configPath: flags.config,
        outDirOverride: flags["out-dir"],
      });
      sourceSchema = build.schema;
      outDir = build.outDir;
    }

    if (!outDir) {
      const project = await new ProjectConfigService().load({
        cwd: flags.cwd,
        configPath: flags.config,
        outDirOverride: flags["out-dir"],
      });
      outDir = project.outDir;
    }

    this.log("Fetching target stack schema...");
    const targetSchema = await remoteSnapshotService.load({
      stackApiKey: flags.stack,
      managementToken: targetRuntime.managementToken,
      cmaBaseUrl: targetRuntime.cmaBaseUrl,
      branch: flags.branch,
    });

    const plan = planService.create(sourceSchema, targetSchema);

    if (plan.operations.length === 0) {
      this.log("No differences found. Source and target are in sync.");
      return;
    }

    if (plan.summary.blocked > 0) {
      this.log(formatter.formatPlan(plan));
      this.error("Promote aborted because the plan contains blocked changes.", { exit: 1 });
    }

    this.log(formatter.formatRemoteRuntimeContext(targetRuntime));
    this.log("");
    this.log(formatter.formatPlan(plan));

    if (flags["dry-run"]) {
      if (flags.json) {
        this.log(formatter.formatJson({ dryRun: true, plan }));
      } else {
        this.log("");
        this.log("Dry run: no changes promoted.");
      }
      return;
    }

    const confirmed = await promptService.confirm("Promote this plan to the target stack?", {
      ci: flags.ci,
      yes: flags.yes,
    });

    if (!confirmed) {
      this.log("Promote cancelled.");
      return;
    }

    let result;
    try {
      result = await applyService.apply(
        plan,
        sourceSchema,
        {
          stackApiKey: flags.stack,
          managementToken: targetRuntime.managementToken,
          cmaBaseUrl: targetRuntime.cmaBaseUrl,
          branch: flags.branch,
        },
        { outDir, resetState: flags["reset-state"] },
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
      this.log(`Promoted ${result.applied.length - result.skipped.length} change set(s) to target stack.`);
      if (result.failed.length > 0) {
        this.warn(`${result.failed.length} operation(s) failed:`);
        for (const failure of result.failed) {
          this.log(`  - ${failure.operationId}: ${failure.error}`);
        }
        if (result.stateFilePath) {
          this.log(`\nState file written to ${result.stateFilePath}`);
          this.log("Re-run promote to retry. Use --reset-state to discard state and start over.");
        }
      }
    }

    if (result.failed.length > 0) {
      this.exit(1);
    }
  }
}
