import {
  normalizeSchema,
  ValidationError,
} from "@timbenniks/contentstack-stacksmith-core";
import type { CompiledBlock, CompiledEntity, CompiledField } from "@timbenniks/contentstack-stacksmith-core";
import type { NormalizableBlockInput, NormalizableFieldInput, SchemaArtifact } from "../public-types.js";

import type {
  ContentTypeDefinition,
  FieldDefinition,
  GlobalFieldDefinition,
  ModelDefinition,
  ModelRegistry,
} from "../definitions/types.js";
import { flattenDefinitions } from "../definitions/entities.js";

const compileField = (field: FieldDefinition, nested = false): NormalizableFieldInput => {
  if (!field.uid) {
    throw new ValidationError("Every field must include a uid.");
  }

  if (field.previousUid !== undefined) {
    if (nested) {
      throw new ValidationError(
        `Field "${field.uid}" has previousUid but is nested inside a group or modular block. Contentstack does not support in-place renames of nested sub-fields; you must remove and re-add the field (and migrate data).`,
      );
    }
    if (typeof field.previousUid !== "string" || field.previousUid.trim().length === 0) {
      throw new ValidationError(`Field "${field.uid}" has an empty previousUid.`);
    }
    if (field.previousUid === field.uid) {
      throw new ValidationError(`Field "${field.uid}" has a previousUid equal to its own uid. Drop previousUid — there is nothing to rename.`);
    }
  }

  const explicitErrorMessages = "errorMessages" in field ? field.errorMessages : undefined;
  const formatErrorMessage = "formatErrorMessage" in field ? field.formatErrorMessage : undefined;
  const mergedErrorMessages = formatErrorMessage !== undefined
    ? { ...(explicitErrorMessages ?? {}), format: formatErrorMessage }
    : explicitErrorMessages;

  const compiledBase = {
    uid: field.uid,
    ...(field.previousUid !== undefined ? { previousUid: field.previousUid } : {}),
    displayName: field.title ?? field.uid,
    kind: field.kind,
    required: field.required ?? false,
    unique: field.unique ?? false,
    multiple: field.multiple ?? false,
    description: field.description,
    defaultValue: field.defaultValue,
    metadata: field.metadata ?? {},
    ...(field.nonLocalizable !== undefined ? { nonLocalizable: field.nonLocalizable } : {}),
    ...(mergedErrorMessages !== undefined ? { errorMessages: mergedErrorMessages } : {}),
    ...("multiline" in field && field.multiline !== undefined ? { multiline: field.multiline } : {}),
    ...("format" in field && field.format !== undefined ? { format: field.format } : {}),
    ...("displayType" in field && field.displayType !== undefined ? { displayType: field.displayType } : {}),
    ...("startDate" in field && field.startDate !== undefined ? { startDate: field.startDate } : {}),
    ...("endDate" in field && field.endDate !== undefined ? { endDate: field.endDate } : {}),
    ...("extensions" in field && field.extensions !== undefined ? { extensions: field.extensions } : {}),
  };

  switch (field.kind) {
    case "reference":
      return {
        ...compiledBase,
        referenceTo: field.to,
        ...(field.refMultipleContentTypes !== undefined
          ? { refMultipleContentTypes: field.refMultipleContentTypes }
          : {}),
      };
    case "global_field":
      return {
        ...compiledBase,
        globalFieldRef: field.ref,
      };
    case "enum":
      return {
        ...compiledBase,
        enumChoices: field.choices,
        ...(field.advanced !== undefined ? { enumAdvanced: field.advanced } : {}),
        ...(field.minInstance !== undefined ? { minInstance: field.minInstance } : {}),
        ...(field.maxInstance !== undefined ? { maxInstance: field.maxInstance } : {}),
      };
    case "group":
      return {
        ...compiledBase,
        fields: field.fields.map((nestedField) => compileField(nestedField, true)),
      };
    case "modular_blocks":
      return {
        ...compiledBase,
        blocks: field.blocks.map<NormalizableBlockInput>((block) =>
          "globalFieldRef" in block
            ? {
                uid: block.uid,
                title: block.title,
                globalFieldRef: block.globalFieldRef,
              }
            : {
                uid: block.uid,
                title: block.title,
                fields: block.fields.map((nestedField) => compileField(nestedField, true)),
              },
        ),
      };
    case "rich_text":
      return {
        ...compiledBase,
        richTextType: field.richTextType ?? "advanced",
      };
    case "json_rte":
      return {
        ...compiledBase,
        richTextType: field.richTextType ?? "advanced",
        referenceTo: field.referenceTo,
        ...(field.plugins !== undefined ? { plugins: field.plugins } : {}),
      };
    case "taxonomy":
      return {
        ...compiledBase,
        taxonomies: field.taxonomies,
      };
    case "text":
    case "number":
    case "boolean":
    case "date":
    case "json":
    case "file":
    case "link":
    case "markdown":
      return compiledBase;
    default: {
      const exhaustive: never = field;
      throw new ValidationError(
        `Unknown field kind "${(exhaustive as { kind: string }).kind}" on field "${(exhaustive as { uid: string }).uid}". Supported kinds: text, number, boolean, date, json, file, link, markdown, reference, enum, group, modular_blocks, global_field, rich_text, json_rte, taxonomy.`,
      );
    }
  }
};

const TITLE_FIELD: NormalizableFieldInput = {
  uid: "title",
  displayName: "Title",
  kind: "text",
  required: true,
  unique: false,
  multiple: false,
  metadata: { _default: true },
};

const ensureTitleField = (fields: NormalizableFieldInput[]): NormalizableFieldInput[] => {
  // Content types always need a required title in the normalized schema. If the
  // user defines one, we preserve it but force the required constraint.
  const hasTitleField = fields.some((field) => field.uid === "title");
  if (hasTitleField) {
    return fields.map((field) =>
      field.uid === "title" ? { ...field, required: true } : field,
    );
  }
  return [TITLE_FIELD, ...fields];
};

const compileEntity = (definition: ContentTypeDefinition | GlobalFieldDefinition) => {
  const compiledFields = definition.fields.map((field) => compileField(field));
  const fields = definition.entityType === "content_type"
    ? ensureTitleField(compiledFields)
    : compiledFields;

  return {
    kind: definition.entityType,
    uid: definition.uid,
    title: definition.title,
    description: definition.description,
    metadata: definition.metadata ?? { origin: "dsl" as const },
    fields,
    ...(definition.entityType === "content_type" ? { options: definition.options } : {}),
  };
};

const assertDefinitions = (definitions: ModelDefinition[]): void => {
  const seen = new Set<string>();

  for (const definition of definitions) {
    const key = `${definition.entityType}:${definition.uid}`;
    if (seen.has(key)) {
      throw new ValidationError(`Duplicate definition detected for ${key}.`);
    }

    seen.add(key);
  }
};

interface ForwardRefIssue {
  entityUid: string;
  fieldPath: string;
  kind: "global_field" | "reference";
  missing: string;
}

const collectFieldIssues = (
  entityUid: string,
  fields: CompiledField[] | undefined,
  pathPrefix: string,
  globalFieldUids: Set<string>,
  contentTypeUids: Set<string>,
  issues: ForwardRefIssue[],
): void => {
  if (!fields) return;
  for (const field of fields) {
    const path = pathPrefix ? `${pathPrefix}.${field.uid}` : field.uid;

    if (field.kind === "global_field" && field.globalFieldRef && !globalFieldUids.has(field.globalFieldRef)) {
      issues.push({ entityUid, fieldPath: path, kind: "global_field", missing: field.globalFieldRef });
    }

    if (field.kind === "reference" && field.referenceTo) {
      for (const target of field.referenceTo) {
        if (!contentTypeUids.has(target)) {
          issues.push({ entityUid, fieldPath: path, kind: "reference", missing: target });
        }
      }
    }

    if (field.fields) {
      collectFieldIssues(entityUid, field.fields, path, globalFieldUids, contentTypeUids, issues);
    }

    if (field.blocks) {
      for (const block of field.blocks as CompiledBlock[]) {
        const blockPath = `${path}.${block.uid}`;
        if (block.globalFieldRef && !globalFieldUids.has(block.globalFieldRef)) {
          issues.push({ entityUid, fieldPath: blockPath, kind: "global_field", missing: block.globalFieldRef });
        }
        collectFieldIssues(entityUid, block.fields, blockPath, globalFieldUids, contentTypeUids, issues);
      }
    }
  }
};

const validateForwardReferences = (artifact: SchemaArtifact): void => {
  const globalFieldUids = new Set<string>();
  const contentTypeUids = new Set<string>();
  for (const entity of artifact.entities as CompiledEntity[]) {
    if (entity.kind === "global_field") globalFieldUids.add(entity.uid);
    else if (entity.kind === "content_type") contentTypeUids.add(entity.uid);
  }

  const issues: ForwardRefIssue[] = [];
  for (const entity of artifact.entities as CompiledEntity[]) {
    collectFieldIssues(entity.uid, entity.fields, "", globalFieldUids, contentTypeUids, issues);
  }

  // normalizeSchema can compute dependency graphs with dangling targets, but the
  // DSL compiler is stricter: unresolved references are almost always authoring mistakes.
  if (issues.length === 0) return;

  const lines = issues.map((issue) =>
    issue.kind === "global_field"
      ? `  - ${issue.entityUid}.${issue.fieldPath} references missing global field "${issue.missing}".`
      : `  - ${issue.entityUid}.${issue.fieldPath} references missing content type "${issue.missing}".`,
  );
  throw new ValidationError(
    `Compile failed: ${issues.length} forward reference(s) could not be resolved.\n${lines.join("\n")}\n\nDefine the missing entities in your model registry or remove the references.`,
  );
};

export const compileDefinitions = (definitions: ModelDefinition[]): SchemaArtifact => {
  assertDefinitions(definitions);
  const artifact = normalizeSchema({
    entities: definitions.map(compileEntity),
    metadata: { origin: "dsl" },
  });
  // Run semantic checks after normalization so nested fields, injected title fields,
  // and dependency information are all in their final canonical shape.
  validateForwardReferences(artifact);
  return artifact;
};

export const compileModelRegistry = (registry: ModelRegistry): SchemaArtifact => compileDefinitions(flattenDefinitions(registry));
