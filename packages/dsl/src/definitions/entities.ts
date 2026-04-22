import type {
  ContentTypeDefinition,
  GlobalFieldDefinition,
  ModelDefinition,
  ModelRegistry,
  ModelsConfig,
} from "./types.js";

const UID_PATTERN = /^[a-z][a-z0-9_]*$/;

const validateEntityUid = (uid: string): void => {
  if (!UID_PATTERN.test(uid)) {
    throw new Error(
      `Invalid UID "${uid}". UIDs must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.`,
    );
  }
};

/** Define a content type with fields, title, and optional options. @throws if UID is invalid. */
export const defineContentType = (
  uid: string,
  definition: Omit<ContentTypeDefinition, "entityType" | "uid">,
): ContentTypeDefinition => {
  validateEntityUid(uid);
  return { entityType: "content_type", uid, ...definition };
};

/** Define a reusable global field with shared fields. @throws if UID is invalid. */
export const defineGlobalField = (
  uid: string,
  definition: Omit<GlobalFieldDefinition, "entityType" | "uid">,
): GlobalFieldDefinition => {
  validateEntityUid(uid);
  return { entityType: "global_field", uid, ...definition };
};

export const defineModels = (registry: ModelRegistry): ModelRegistry => registry;

export const defineModelsConfig = (config: ModelsConfig): ModelsConfig => ({
  modelsEntry: "./src/models/index.ts",
  outDir: "./.contentstack/models",
  strict: true,
  ...config,
});

export const flattenDefinitions = (registry: ModelRegistry): ModelDefinition[] => [
  ...(registry.definitions ?? []),
  ...(registry.globalFields ?? []),
  ...(registry.contentTypes ?? []),
];
