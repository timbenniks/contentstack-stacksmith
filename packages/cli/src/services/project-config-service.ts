import { access } from "node:fs/promises";
import { resolve, dirname } from "node:path";

import { defineModelsConfig, type ModelsConfig } from "@timbenniks/contentstack-stacksmith";

import { createCliJiti } from "../utils/jiti-loader.js";

export interface LoadedProjectConfig {
  config: ModelsConfig;
  cwd: string;
  configPath: string;
  modelsEntry: string;
  outDir: string;
}

export class ProjectConfigService {
  async load(input: { cwd?: string; configPath?: string; outDirOverride?: string }): Promise<LoadedProjectConfig> {
    const cwd = resolve(input.cwd ?? process.cwd());
    const configPath = resolve(cwd, input.configPath ?? "contentstack.stacksmith.config.ts");
    const loader = createCliJiti(__filename);

    try {
      await access(configPath);
    } catch {
      throw new Error(`Config file not found at ${configPath}. Run "csdx stacksmith:init" to create one.`);
    }

    let loaded: { default?: ModelsConfig; config?: ModelsConfig } & ModelsConfig;
    try {
      loaded = (await loader.import(configPath)) as typeof loaded;
    } catch (error) {
      throw new Error(
        `Could not load config from ${configPath}. Ensure it exports a valid config object.\nOriginal error: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    const config = defineModelsConfig(loaded.default ?? loaded.config ?? loaded);

    return {
      cwd,
      config,
      configPath,
      modelsEntry: resolve(dirname(configPath), config.modelsEntry ?? "./src/models/index.ts"),
      outDir: resolve(dirname(configPath), input.outDirOverride ?? config.outDir ?? "./.contentstack/models"),
    };
  }
}
