import type { ModelRegistry } from "@timbenniks/contentstack-stacksmith";

import { createCliJiti } from "../utils/jiti-loader.js";

export class ModelLoaderService {
  async load(modelsEntry: string): Promise<{ registry: ModelRegistry; sourceFiles: string[] }> {
    const loader = createCliJiti(__filename);
    let loaded: { default?: ModelRegistry; models?: ModelRegistry } & ModelRegistry;
    try {
      loaded = (await loader.import(modelsEntry)) as typeof loaded;
    } catch (error) {
      throw new Error(
        `Could not load models from ${modelsEntry}. Ensure the file exports a ModelRegistry via "default" or "models".\nOriginal error: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    const registry = (loaded.default ?? loaded.models ?? loaded) as ModelRegistry;

    return {
      registry,
      sourceFiles: [modelsEntry],
    };
  }
}
