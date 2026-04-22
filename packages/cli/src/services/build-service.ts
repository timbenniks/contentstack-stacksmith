import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { toCanonicalJson } from "@timbenniks/contentstack-stacksmith";
import { compileModelRegistry } from "@timbenniks/contentstack-stacksmith";
import { validateSchema } from "@timbenniks/contentstack-stacksmith";

import type { SchemaArtifact, ValidationFinding } from "@timbenniks/contentstack-stacksmith";

import { ModelLoaderService } from "./model-loader-service.js";
import { ProjectConfigService } from "./project-config-service.js";
import { readInstalledPackageVersion } from "../utils/package-version.js";

export interface BuildResult {
  schema: SchemaArtifact;
  schemaPath: string;
  manifestPath: string;
  outDir: string;
  sourceFiles: string[];
  findings: ValidationFinding[];
  manifest: Record<string, unknown>;
}

export class BuildService {
  constructor(
    private readonly projectConfigService = new ProjectConfigService(),
    private readonly modelLoaderService = new ModelLoaderService(),
  ) {}

  async build(input: { cwd?: string; configPath?: string; outDirOverride?: string }): Promise<BuildResult> {
    const project = await this.projectConfigService.load(input);
    const { registry, sourceFiles } = await this.modelLoaderService.load(project.modelsEntry);
    const schema = compileModelRegistry(registry);
    const findings = validateSchema(schema);
    const schemaJson = toCanonicalJson(schema);
    const schemaHash = createHash("sha256").update(schemaJson).digest("hex");

    await mkdir(project.outDir, { recursive: true });

    const schemaPath = join(project.outDir, "schema.json");
    const manifestPath = join(project.outDir, "manifest.json");
    const cliVersion = readInstalledPackageVersion("@timbenniks/contentstack-stacksmith-cli");
    const manifest = {
      projectName: project.config.projectName,
      schemaHash,
      sourceFiles: [project.configPath, ...sourceFiles],
      compilerVersion: cliVersion,
      packageVersions: {
        models: readInstalledPackageVersion("@timbenniks/contentstack-stacksmith"),
        cli: cliVersion,
      },
      artifacts: {
        schema: schemaPath,
        manifest: manifestPath,
      },
    };

    await writeFile(schemaPath, schemaJson);
    await writeFile(manifestPath, toCanonicalJson(manifest));

    return {
      schema,
      schemaPath,
      manifestPath,
      outDir: project.outDir,
      sourceFiles,
      findings,
      manifest,
    };
  }
}
