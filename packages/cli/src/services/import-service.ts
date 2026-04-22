import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

import type { DiffResult, SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

import { ContentTypeRepository } from "../integrations/contentstack/content-type-repository.js";
import { GlobalFieldRepository } from "../integrations/contentstack/global-field-repository.js";
import { ManagementClientFactory, type ManagementClientOptions } from "../integrations/contentstack/management-client-factory.js";
import { RemoteSchemaMapper } from "../integrations/contentstack/remote-schema-mapper.js";
import { BuildService } from "./build-service.js";
import { DiffService } from "./diff-service.js";
import { ImportCodegenService, type GeneratedImportFile } from "./import-codegen-service.js";
import { ProjectConfigService } from "./project-config-service.js";
import { readInstalledPackageVersion } from "../utils/package-version.js";

export interface ImportInput extends ManagementClientOptions {
  cwd?: string | undefined;
  force?: boolean | undefined;
}

export interface ImportManifest {
  sourceStackApiKey: string;
  sourceBranch?: string | undefined;
  generatorVersion: string;
  generatedFiles: string[];
  contentTypeUids: string[];
  globalFieldUids: string[];
  generatedAt: string;
}

export interface ImportResult {
  cwd: string;
  projectName: string;
  manifestPath: string;
  generatedFiles: string[];
  scaffoldedFiles: string[];
  contentTypeUids: string[];
  globalFieldUids: string[];
  schemaPath: string;
  buildManifestPath: string;
}

export interface ImportFailureDetails {
  code: string;
  cwd: string;
  generatedFiles?: string[] | undefined;
  residualOperations?: number | undefined;
  residualCategories?: string[] | undefined;
}

export class ImportFailureError extends Error {
  constructor(
    message: string,
    readonly details: ImportFailureDetails,
  ) {
    super(message);
    this.name = "ImportFailureError";
  }
}

interface ResolvedImportProject {
  cwd: string;
  projectName: string;
  packageName: string;
  configPath: string;
  modelsEntryPath: string;
  outDir: string;
}

const IMPORT_MANIFEST_FILE = "import-manifest.json";

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const detectMonorepo = (cwd: string): boolean => {
  let current = resolve(cwd);
  const { root } = parse(current);

  // Walk upward so imports created inside a package of a larger workspace can
  // use workspace-local dependency ranges instead of pinning a published version.
  while (current !== root) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return true;
    if (existsSync(join(current, "lerna.json"))) return true;

    const packageJsonPath = join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { workspaces?: unknown };
        if (pkg.workspaces) return true;
      } catch {
        // Ignore malformed package.json and keep walking up
      }
    }

    current = dirname(current);
  }

  return (
    existsSync(join(root, "pnpm-workspace.yaml")) ||
    existsSync(join(root, "lerna.json")) ||
    (() => {
      const packageJsonPath = join(root, "package.json");
      if (!existsSync(packageJsonPath)) return false;

      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { workspaces?: unknown };
        return Boolean(pkg.workspaces);
      } catch {
        return false;
      }
    })()
  );
};

const categorizeResidualDiff = (diff: DiffResult): string[] => {
  const categories = new Set<string>();

  // Collapse raw diff details into a few buckets the command can surface as
  // likely causes without dumping the full internal diff model.
  for (const operation of diff.operations) {
    if (operation.details.some((detail) => detail.path.includes(".kind"))) {
      categories.add("unsupported field mapping");
      continue;
    }

    if (operation.details.some((detail) =>
      detail.path.includes("displayName") ||
      detail.path.includes("title") ||
      detail.path.includes("description") ||
      detail.path.includes("options") ||
      detail.path.includes("defaultValue"),
    )) {
      categories.add("metadata mismatch");
      continue;
    }

    categories.add("generator mismatch");
  }

  return [...categories];
};

const readImportManifest = async (path: string): Promise<ImportManifest | undefined> => {
  if (!await pathExists(path)) return undefined;

  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as ImportManifest;
};

const writeImportManifest = async (path: string, manifest: ImportManifest): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
};

const resolveProjectFilePath = (
  cwd: string,
  file: string,
  mode: "read" | "write" | "delete",
): string => {
  const projectRoot = resolve(cwd);
  const resolvedPath = resolve(projectRoot, file);
  const relativePath = relative(projectRoot, resolvedPath);

  // Import manifests live on disk and can be stale or tampered with, so every
  // managed path is re-validated before we trust it for reads, writes, or deletes.
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new ImportFailureError(
      `Refusing to ${mode} import-managed path outside the target project directory: ${file}`,
      {
        code: "IMPORT_PATH_OUTSIDE_PROJECT",
        cwd: projectRoot,
        generatedFiles: [file],
      },
    );
  }

  return resolvedPath;
};

export class ImportService {
  constructor(
    private readonly managementClientFactory = new ManagementClientFactory(),
    private readonly mapper = new RemoteSchemaMapper(),
    private readonly buildService = new BuildService(),
    private readonly diffService = new DiffService(),
    private readonly projectConfigService = new ProjectConfigService(),
    private readonly codegenService = new ImportCodegenService(),
  ) {}

  async import(input: ImportInput): Promise<ImportResult> {
    const project = await this.resolveProject(input.cwd);
    const generatorVersion = readInstalledPackageVersion("@timbenniks/contentstack-stacksmith-cli", "0.1.0");
    const modelsVersion = readInstalledPackageVersion("@timbenniks/contentstack-stacksmith", "0.1.0");
    const manifestPath = join(project.outDir, IMPORT_MANIFEST_FILE);
    const previousManifest = await readImportManifest(manifestPath);
    const remote = await this.fetchRemote(input);
    const generated = this.codegenService.generate({
      cwd: project.cwd,
      projectName: project.projectName,
      packageName: project.packageName,
      modelsEntryPath: project.modelsEntryPath,
      configPath: project.configPath,
      modelsVersion,
      contentTypes: remote.contentTypes,
      globalFields: remote.globalFields,
      isMonorepo: detectMonorepo(project.cwd),
    });

    await this.assertWritableProject(project.cwd, generated.files, previousManifest, Boolean(input.force));

    if (input.force && previousManifest) {
      // Remove the previously managed set first so files for deleted entities do
      // not linger after a refresh.
      await this.deleteManagedFiles(project.cwd, previousManifest.generatedFiles);
      if (await pathExists(manifestPath)) {
        await unlink(manifestPath);
      }
    }

    const scaffoldedFiles = await this.writeFiles(project.cwd, generated.files);
    const build = await this.buildService.build({ cwd: project.cwd });

    if (build.findings.some((finding) => finding.level === "blocker")) {
      throw new ImportFailureError(
        "Imported project failed local build validation.",
        {
          code: "BUILD_BLOCKED",
          cwd: project.cwd,
          generatedFiles: generated.managedFiles,
        },
      );
    }

    const diff = this.diffService.create(build.schema, remote.schema);
    // Import only counts as successful if the generated DSL round-trips back to
    // the same schema shape we fetched from Contentstack.
    if (diff.operations.length > 0) {
      throw new ImportFailureError(
        `Imported models did not reach parity with the source stack (${diff.operations.length} operation(s) remain).`,
        {
          code: "PARITY_MISMATCH",
          cwd: project.cwd,
          generatedFiles: generated.managedFiles,
          residualOperations: diff.operations.length,
          residualCategories: categorizeResidualDiff(diff),
        },
      );
    }

    await writeImportManifest(manifestPath, {
      sourceStackApiKey: input.stackApiKey,
      sourceBranch: input.branch,
      generatorVersion,
      generatedFiles: generated.managedFiles,
      contentTypeUids: generated.contentTypeUids,
      globalFieldUids: generated.globalFieldUids,
      generatedAt: new Date().toISOString(),
    });

    return {
      cwd: project.cwd,
      projectName: project.projectName,
      manifestPath,
      generatedFiles: generated.managedFiles,
      scaffoldedFiles,
      contentTypeUids: generated.contentTypeUids,
      globalFieldUids: generated.globalFieldUids,
      schemaPath: build.schemaPath,
      buildManifestPath: build.manifestPath,
    };
  }

  private async resolveProject(cwdInput?: string): Promise<ResolvedImportProject> {
    const cwd = resolve(cwdInput ?? process.cwd());
    const configPath = resolve(cwd, "contentstack.stacksmith.config.ts");
    const packageName = basename(cwd);

    if (await pathExists(configPath)) {
      const loaded = await this.projectConfigService.load({ cwd });
      return {
        cwd,
        projectName: loaded.config.projectName,
        packageName,
        configPath: loaded.configPath,
        modelsEntryPath: loaded.modelsEntry,
        outDir: loaded.outDir,
      };
    }

    return {
      cwd,
      projectName: packageName,
      packageName,
      configPath,
      modelsEntryPath: resolve(cwd, "src/models/index.ts"),
      outDir: resolve(cwd, ".contentstack/models"),
    };
  }

  private async fetchRemote(input: ImportInput): Promise<{
    contentTypes: Record<string, any>[];
    globalFields: Record<string, any>[];
    schema: SchemaArtifact;
  }> {
    const client = this.managementClientFactory.create({
      stackApiKey: input.stackApiKey,
      managementToken: input.managementToken,
      cmaBaseUrl: input.cmaBaseUrl,
      branch: input.branch,
    });

    const contentTypeRepository = new ContentTypeRepository(client);
    const globalFieldRepository = new GlobalFieldRepository(client);
    const [contentTypes, globalFields] = await Promise.all([
      contentTypeRepository.list(),
      globalFieldRepository.list(),
    ]);

    return {
      contentTypes,
      globalFields,
      schema: this.mapper.toSchemaArtifact(contentTypes, globalFields),
    };
  }

  private async assertWritableProject(
    cwd: string,
    files: GeneratedImportFile[],
    previousManifest: ImportManifest | undefined,
    force: boolean,
  ): Promise<void> {
    const managedFiles = files
      .filter((file) => file.managed)
      .map((file) => resolveProjectFilePath(cwd, file.path, "write"));
    const existingManagedFiles = [];

    for (const file of managedFiles) {
      if (await pathExists(file)) {
        existingManagedFiles.push(relative(cwd, file));
      }
    }

    if (!force && (previousManifest || existingManagedFiles.length > 0)) {
      throw new ImportFailureError(
        "Import target already contains import-managed model files. Re-run with --force to refresh them.",
        {
          code: "IMPORT_TARGET_EXISTS",
          cwd,
          generatedFiles: existingManagedFiles,
        },
      );
    }

    if (force && !previousManifest && existingManagedFiles.length > 0) {
      throw new ImportFailureError(
        "Cannot safely refresh existing generated files because no prior import manifest was found.",
        {
          code: "IMPORT_MANIFEST_MISSING",
          cwd,
          generatedFiles: existingManagedFiles,
        },
      );
    }
  }

  private async deleteManagedFiles(cwd: string, files: string[]): Promise<void> {
    for (const file of files) {
      await rm(resolveProjectFilePath(cwd, file, "delete"), { force: true });
    }
  }

  private async writeFiles(cwd: string, files: GeneratedImportFile[]): Promise<string[]> {
    const createdScaffoldFiles: string[] = [];

    for (const file of files) {
      const targetPath = resolveProjectFilePath(cwd, file.path, "write");
      await mkdir(dirname(targetPath), { recursive: true });

      // Scaffold files bootstrap a project once; on later runs we preserve any
      // user edits and only overwrite import-managed files.
      if (!file.managed && await pathExists(targetPath)) {
        continue;
      }

      await writeFile(targetPath, file.content);

      if (!file.managed) {
        createdScaffoldFiles.push(file.path);
      }
    }

    return createdScaffoldFiles;
  }
}
