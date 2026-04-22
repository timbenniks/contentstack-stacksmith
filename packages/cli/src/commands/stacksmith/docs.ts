import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { BuildService } from "../../services/build-service.js";
import { defaultDocsExtension, DocsService } from "../../services/docs-service.js";
import { automationFlags, buildFlags } from "../../utils/common-flags.js";

export default class ModelsDocs extends Command {
  static description = "Generate documentation from compiled model definitions in Markdown, JSON, or HTML.";

  static examples = [
    "$ csdx stacksmith:docs",
    "$ csdx stacksmith:docs --output ./docs/models.md",
    "$ csdx stacksmith:docs --format json --output ./docs/models.json",
    "$ csdx stacksmith:docs --format html --output ./docs/models.html",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    format: flags.string({
      description: "Documentation output format.",
      options: ["md", "json", "html"],
      default: "md",
    }),
    output: flags.string({
      description: "Output file path for the generated documentation.",
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsDocs);
    const buildService = new BuildService();
    const docsService = new DocsService();

    const build = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });

    const projectName = build.manifest.projectName as string ?? "Contentstack Stacksmith";
    const format = flags.format as "md" | "json" | "html";
    const output = docsService.generate(build.schema, projectName, format);
    const outputPath = flags.output ?? join(build.outDir, `models.${defaultDocsExtension(format)}`);

    await writeFile(outputPath, output);

    this.log(flags.json
      ? JSON.stringify({ output: outputPath, format })
      : `Documentation generated at ${outputPath}`);
  }
}
