import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { Command } from "@contentstack/cli-command";
import { flags, type FlagInput } from "@contentstack/cli-utilities";

import type { CompiledEntity } from "@timbenniks/contentstack-stacksmith";

import { RemoteSchemaMapper } from "../../integrations/contentstack/remote-schema-mapper.js";
import { BuildService } from "../../services/build-service.js";
import { automationFlags, buildFlags } from "../../utils/common-flags.js";

export default class ModelsTypegen extends Command {
  static description = "Generate TypeScript type definitions from local DSL (default) or from a live stack with --from-stack.";

  static examples = [
    "$ csdx stacksmith:typegen --output ./types/contentstack.d.ts",
    "$ csdx stacksmith:typegen --cwd apps/example-project --output ./types.d.ts --prefix I",
    "$ csdx stacksmith:typegen --from-stack --token-alias my-delivery-token --output ./types.d.ts",
  ];

  static flags: FlagInput = {
    ...buildFlags,
    "from-stack": flags.boolean({
      description: "Fetch content types from a live stack via the Delivery API instead of generating from local DSL.",
      default: false,
    }),
    "token-alias": flags.string({
      char: "a",
      description: "Delivery token alias. Required when --from-stack is set.",
    }),
    output: flags.string({
      char: "o",
      description: "Full path to the output TypeScript file.",
      required: true,
    }),
    prefix: flags.string({
      char: "p",
      description: "Interface prefix (e.g. 'I' for IBlogPost).",
      default: "",
    }),
    doc: flags.boolean({
      char: "d",
      description: "Include JSDoc documentation comments.",
      default: true,
      allowNo: true,
    }),
    branch: flags.string({
      description: "Branch to generate types from (live-stack mode only).",
    }),
    "include-system-fields": flags.boolean({
      description: "Include system fields (uid, created_at, etc.) in generated types.",
      default: false,
    }),
    "include-editable-tags": flags.boolean({
      description: "Include editable tags for visual builder.",
      default: false,
    }),
    "include-referenced-entry": flags.boolean({
      description: "Add a generic ReferencedEntry interface.",
      default: false,
    }),
    "api-type": flags.string({
      description: "API type to generate types for. GraphQL requires --from-stack.",
      default: "rest",
      options: ["rest", "graphql"],
    }),
    namespace: flags.string({
      description: "Namespace for GraphQL types.",
    }),
    ...automationFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ModelsTypegen);
    const outputPath = resolve(flags.output);

    if (flags["api-type"] === "graphql" && !flags["from-stack"]) {
      this.error(
        "GraphQL typegen requires --from-stack. Local DSL-based GraphQL schema generation is not supported; use REST mode for offline typegen or pass --from-stack with a delivery token.",
        { exit: 1 },
      );
    }

    let result: string | undefined;

    if (flags["from-stack"]) {
      result = await this.generateFromStack(flags);
    } else {
      result = await this.generateFromLocalDsl(flags);
    }

    if (!result) {
      this.error("Type generation returned empty output.", { exit: 1 });
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result);

    this.log(flags.json ? JSON.stringify({ output: outputPath, source: flags["from-stack"] ? "stack" : "local" }) : `TypeScript types generated at ${outputPath}`);
  }

  private async generateFromLocalDsl(flags: Record<string, any>): Promise<string> {
    const buildService = new BuildService();
    const build = await buildService.build({
      cwd: flags.cwd,
      configPath: flags.config,
      outDirOverride: flags["out-dir"],
    });

    const mapper = new RemoteSchemaMapper();
    const contentTypePayloads: Record<string, any>[] = [];
    const globalFieldPayloads: Record<string, any>[] = [];

    for (const entity of build.schema.entities as CompiledEntity[]) {
      const envelope = mapper.toContentstackEntity(entity);
      if (entity.kind === "content_type") {
        contentTypePayloads.push(envelope.content_type);
      } else {
        globalFieldPayloads.push({ ...envelope.global_field, schema_type: "global_field" });
      }
    }

    if (contentTypePayloads.length === 0) {
      this.error("No content types found in the local DSL. Define at least one content type before running typegen.", { exit: 1 });
    }

    const merged = [...globalFieldPayloads, ...contentTypePayloads];

    const { generateTSFromContentTypes } = await import("@contentstack/types-generator");
    return generateTSFromContentTypes({
      contentTypes: merged,
      prefix: flags.prefix ?? "",
      includeDocumentation: flags.doc,
      systemFields: flags["include-system-fields"],
      isEditableTags: flags["include-editable-tags"],
      includeReferencedEntry: flags["include-referenced-entry"],
    });
  }

  private async generateFromStack(flags: Record<string, any>): Promise<string | undefined> {
    if (!flags["token-alias"]) {
      this.error("--token-alias is required with --from-stack.", { exit: 1 });
    }

    const token = this.getToken(flags["token-alias"]);
    if (!token || typeof token !== "object") {
      this.error(`Could not resolve delivery token for alias "${flags["token-alias"]}". Add one with: csdx auth:tokens:add`, { exit: 1 });
    }

    const tokenData = token as { apiKey?: string; token?: string; environment?: string };
    if (!tokenData.apiKey || !tokenData.token) {
      this.error(`Delivery token alias "${flags["token-alias"]}" is missing apiKey or token.`, { exit: 1 });
    }

    const regionName = this.region?.name === "NA" ? "us" : (this.region?.name ?? "us").toLowerCase();

    if (flags["api-type"] === "graphql") {
      const { graphqlTS } = await import("@contentstack/types-generator");
      return graphqlTS({
        apiKey: tokenData.apiKey,
        token: tokenData.token,
        environment: tokenData.environment ?? "",
        namespace: flags.namespace ?? "",
        region: regionName as any,
        host: this.cdaHost ?? undefined,
      });
    }

    const { generateTS } = await import("@contentstack/types-generator");
    return generateTS({
      apiKey: tokenData.apiKey,
      token: tokenData.token,
      region: regionName as any,
      environment: tokenData.environment ?? "",
      branch: flags.branch,
      host: this.cdaHost ?? undefined,
      tokenType: "delivery",
      includeDocumentation: flags.doc,
      prefix: flags.prefix ?? "",
      systemFields: flags["include-system-fields"],
      isEditableTags: flags["include-editable-tags"],
      includeReferencedEntry: flags["include-referenced-entry"],
    });
  }
}
