import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { OutputFormatterService } from "../../formatters/output-formatter-service.js";
import { ImportFailureError, ImportService } from "../../services/import-service.js";
import { ensureParentCliRuntimeContext } from "../../utils/parent-cli-context.js";

export default class ModelsImport extends Command {
  static description = "Import content types and global fields from a Contentstack stack into DSL source files.";

  static examples = [
    "$ csdx stacksmith:import --stack blt123 --token-alias my-stack --cwd ./apps/developers-cs-website",
    "$ csdx stacksmith:import --stack blt123 --token-alias my-stack --cwd ./apps/developers-cs-website --force",
  ];

  static flags: FlagInput = {
    cwd: flags.string({
      description: "Target project directory.",
    }),
    stack: flags.string({
      char: "s",
      description: "Source stack API key.",
      required: true,
    }),
    "token-alias": flags.string({
      char: "t",
      description: "Contentstack management token alias for the source stack.",
    }),
    "management-token": flags.string({
      description: "Management token for the source stack. Overrides --token-alias and any parent CLI session.",
    }),
    branch: flags.string({
      description: "Source branch on the Contentstack stack.",
    }),
    force: flags.boolean({
      description: "Replace the existing import-managed model files.",
      default: false,
    }),
    ci: flags.boolean({
      description: "Disable prompts and require non-interactive behavior.",
      default: false,
    }),
    json: flags.boolean({
      description: "Emit machine-readable JSON output.",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsImport);
    const formatter = new OutputFormatterService();
    const importService = new ImportService();

    let runtime;
    try {
      runtime = await ensureParentCliRuntimeContext(this, {
        flagToken: flags["management-token"],
        tokenAlias: flags["token-alias"],
        ci: Boolean(flags.ci),
        purpose: "import",
      });
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }

    try {
      const result = await importService.import({
        cwd: flags.cwd,
        stackApiKey: flags.stack,
        managementToken: runtime.managementToken,
        cmaBaseUrl: runtime.cmaBaseUrl,
        branch: flags.branch,
        force: flags.force,
      });

      this.log(flags.json ? formatter.formatJson(result) : formatter.formatImport(result));
    } catch (error) {
      if (error instanceof ImportFailureError) {
        if (flags.json) {
          this.log(formatter.formatJson({
            success: false,
            error: error.message,
            ...error.details,
          }));
          this.exit(1);
          return;
        }

        const details = [
          error.message,
          ...(error.details.residualCategories?.length
            ? [`Likely causes: ${error.details.residualCategories.join(", ")}`]
            : []),
        ];

        this.error(details.join("\n"), { exit: 1 });
      }

      throw error;
    }
  }
}
