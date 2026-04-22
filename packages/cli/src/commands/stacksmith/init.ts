import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import { PromptService } from "../../prompts/prompt-service.js";

const templates = {
  config: `import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "contentstack-stacksmith-project",
});
`,
  index: `import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
`,
  author: `import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});
`,
  blogPost: `import { defineContentType, globalField, reference, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
`,
  seo: `import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});
`,
};

export default class ModelsInit extends Command {
  static description = "Scaffold a starter models-as-code project structure.";

  static examples = [
    "$ csdx stacksmith:init",
    "$ csdx stacksmith:init --dir ./my-models-project --yes --ci",
  ];

  static flags: FlagInput = {
    dir: flags.string({
      description: "Target directory to scaffold.",
    }),
    force: flags.boolean({
      description: "Overwrite existing files.",
      default: false,
    }),
    yes: flags.boolean({
      char: "y",
      description: "Accept the default target directory.",
      default: false,
    }),
    ci: flags.boolean({
      description: "Disable prompts.",
      default: false,
    }),
    json: flags.boolean({
      description: "Return machine-readable JSON output.",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsInit);
    const promptService = new PromptService();
    const selectedDir =
      flags.dir ??
      (await promptService.ask("Where should the models project be created?", {
        ci: flags.ci || flags.yes,
        defaultValue: ".",
      }));
    const targetDir = resolve(selectedDir);

    await mkdir(join(targetDir, "src/models/content-types"), { recursive: true });
    await mkdir(join(targetDir, "src/models/global-fields"), { recursive: true });

    const safeWrite = async (path: string, content: string) => {
      try {
        await writeFile(path, content, { flag: flags.force ? "w" : "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
          throw new Error(`File already exists at ${path}. Use --force to overwrite.`, { cause: error });
        }
        throw error;
      }
    };

    await safeWrite(join(targetDir, "contentstack.stacksmith.config.ts"), templates.config);
    await safeWrite(join(targetDir, "src/models/index.ts"), templates.index);
    await safeWrite(join(targetDir, "src/models/content-types/author.ts"), templates.author);
    await safeWrite(join(targetDir, "src/models/content-types/blog-post.ts"), templates.blogPost);
    await safeWrite(join(targetDir, "src/models/global-fields/seo.ts"), templates.seo);

    const payload = { targetDir, filesCreated: 5 };
    this.log(flags.json ? JSON.stringify(payload, null, 2) : `Initialized models project in ${targetDir}`);
  }
}
