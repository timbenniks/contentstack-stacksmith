import type {
  CompiledBlock,
  CompiledEntity,
  CompiledField,
  DependencyRef,
  FieldKind,
  NormalizableBlockInput,
  NormalizableFieldInput,
  SchemaArtifact,
  SchemaInput,
} from "../schema/types.js";
import { SCHEMA_VERSION } from "../schema/types.js";
import { ValidationError } from "../errors/core-error.js";

type InputField = NormalizableFieldInput | CompiledField;

/**
 * Hard cap on recursion depth while walking nested fields, groups, and blocks.
 * Contentstack's own plan limits top out at ~5 levels of modular-blocks nesting;
 * 50 is an order of magnitude of headroom. Anything deeper is a cycle or a bug
 * and we'd rather fail loudly than stack-overflow.
 */
const MAX_FIELD_DEPTH = 50;

const entityId = (kind: CompiledEntity["kind"], uid: string): string => `${kind}:${uid}`;
const fieldId = (parentEntityId: string, uid: string): string => `${parentEntityId}.field:${uid}`;

const dedupeDependencies = (dependencies: DependencyRef[]): DependencyRef[] => {
  const seen = new Map<string, DependencyRef>();

  for (const dependency of dependencies) {
    const key = [
      dependency.sourceEntityId,
      dependency.targetEntityId,
      dependency.sourceFieldId ?? "",
      dependency.reason,
    ].join(":");

    if (!seen.has(key)) {
      seen.set(key, dependency);
    }
  }

  return [...seen.values()].sort((left, right) =>
    left.targetEntityId.localeCompare(right.targetEntityId) ||
    left.reason.localeCompare(right.reason) ||
    (left.sourceFieldId ?? "").localeCompare(right.sourceFieldId ?? ""),
  );
};

const createDependency = (
  sourceEntityId: string,
  sourceFieldId: string,
  kind: "content_type" | "global_field",
  uid: string,
  reason: DependencyRef["reason"],
): DependencyRef => {
  const sourceUid = sourceEntityId.split(":")[1];
  const description = reason === "global_field"
    ? `${sourceUid} depends on global field ${uid}`
    : reason === "modular_block_reference"
      ? `${sourceUid} embeds global field ${uid} as a modular block`
      : `${sourceUid} references ${uid}`;

  return {
    sourceEntityId,
    sourceFieldId,
    targetEntityId: entityId(kind, uid),
    kind,
    uid,
    reason,
    description,
  };
};

const normalizeBlocks = (
  blocks: NormalizableBlockInput[] | CompiledBlock[] | undefined,
  sourceEntityId: string,
  depth: number,
): CompiledBlock[] | undefined =>
  blocks?.map((block) => {
    if (block.globalFieldRef) {
      return {
        uid: block.uid,
        title: block.title,
        globalFieldRef: block.globalFieldRef,
      };
    }

    return {
      uid: block.uid,
      title: block.title,
      fields: normalizeFields(block.fields ?? [], sourceEntityId, depth + 1, `block:${block.uid}`),
    };
  });

const getExistingDependencies = (field: InputField): DependencyRef[] =>
  "dependencies" in field ? field.dependencies : [];

const normalizeFields = (
  fields: InputField[],
  sourceEntityId: string,
  depth: number,
  nestedPrefix?: string,
): CompiledField[] => {
  if (depth > MAX_FIELD_DEPTH) {
    throw new ValidationError(
      `Field nesting exceeded the safety cap of ${MAX_FIELD_DEPTH} levels in ${sourceEntityId}${nestedPrefix ? ` at ${nestedPrefix}` : ""}. This usually indicates a cyclic global_field reference or a deeply recursive group/modular-blocks structure.`,
    );
  }
  return fields.map((field, index) => {
    const normalizedId = nestedPrefix
      ? `${fieldId(sourceEntityId, `${nestedPrefix}.${field.uid}`)}`
      : fieldId(sourceEntityId, field.uid);

    const dependencies: DependencyRef[] = [];

    if (field.kind === "reference") {
      for (const uid of field.referenceTo ?? []) {
        dependencies.push(createDependency(sourceEntityId, normalizedId, "content_type", uid, "reference"));
      }
    }

    if (field.kind === "global_field" && field.globalFieldRef) {
      dependencies.push(
        createDependency(sourceEntityId, normalizedId, "global_field", field.globalFieldRef, "global_field"),
      );
    }

    const childFields = field.fields
      ? normalizeFields(field.fields, sourceEntityId, depth + 1, nestedPrefix ? `${nestedPrefix}.${field.uid}` : field.uid)
      : undefined;

    const blocks = normalizeBlocks(field.blocks, sourceEntityId, depth + 1);

    if (blocks) {
      for (const block of blocks) {
        if (block.globalFieldRef) {
          dependencies.push(
            createDependency(
              sourceEntityId,
              normalizedId,
              "global_field",
              block.globalFieldRef,
              "modular_block_reference",
            ),
          );
          continue;
        }

        for (const childField of block.fields ?? []) {
          dependencies.push(...childField.dependencies);
        }
      }
    }

    if (childFields) {
      for (const childField of childFields) {
        dependencies.push(...childField.dependencies);
      }
    }

    return {
      ...field,
      id: normalizedId,
      order: index,
      required: field.required ?? false,
      unique: field.unique ?? false,
      multiple: field.multiple ?? false,
      metadata: field.metadata ?? {},
      fields: childFields,
      blocks,
      dependencies: dedupeDependencies([...dependencies, ...getExistingDependencies(field)]),
    } satisfies CompiledField;
  });
};

const sortEntities = (entities: CompiledEntity[]): CompiledEntity[] =>
  [...entities].sort((left, right) => left.kind.localeCompare(right.kind) || left.uid.localeCompare(right.uid));

const VALID_ENTITY_KINDS = new Set(["content_type", "global_field"]);

const validateInput = (input: SchemaInput | SchemaArtifact): void => {
  const uidsByKind = new Map<string, Set<string>>();

  for (let i = 0; i < input.entities.length; i++) {
    const entity = input.entities[i]!;

    if (!entity.uid || typeof entity.uid !== "string" || entity.uid.trim().length === 0) {
      throw new ValidationError(`Entity at index ${i} has an empty or missing uid.`);
    }

    if (!VALID_ENTITY_KINDS.has(entity.kind)) {
      throw new ValidationError(`Entity '${entity.uid}' has invalid kind '${entity.kind}'.`);
    }

    const kindSet = uidsByKind.get(entity.kind) ?? new Set<string>();
    if (kindSet.has(entity.uid)) {
      throw new ValidationError(`Duplicate uid '${entity.uid}' for kind '${entity.kind}'.`);
    }
    kindSet.add(entity.uid);
    uidsByKind.set(entity.kind, kindSet);

    const fieldUids = new Set<string>();
    for (const field of entity.fields) {
      if (!field.uid || typeof field.uid !== "string" || field.uid.trim().length === 0) {
        throw new ValidationError(`Field in entity '${entity.uid}' has an empty or missing uid.`);
      }
      if (fieldUids.has(field.uid)) {
        throw new ValidationError(`Duplicate field uid '${field.uid}' in entity '${entity.uid}'.`);
      }
      fieldUids.add(field.uid);
    }
  }
};

/**
 * Normalize a schema input into a canonical SchemaArtifact with deterministic ordering,
 * hierarchical field IDs, and resolved dependencies.
 * @param input - Raw schema input or an existing artifact to re-normalize
 * @returns Normalized schema artifact with sorted entities and computed dependencies
 * @throws ValidationError if duplicate UIDs, empty UIDs, or invalid entity kinds are found
 */
export const normalizeSchema = (input: SchemaInput | SchemaArtifact): SchemaArtifact => {
  validateInput(input);

  const entities = input.entities.map((entity) => {
    const normalizedEntityId = entityId(entity.kind, entity.uid);
    const fields = normalizeFields(entity.fields, normalizedEntityId, 0);
    const dependencies = dedupeDependencies(fields.flatMap((field) => field.dependencies));

    return {
      ...entity,
      id: normalizedEntityId,
      fields,
      dependencies,
      metadata: entity.metadata ?? {},
    } satisfies CompiledEntity;
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: input.metadata ?? {},
    entities: sortEntities(entities),
  };
};

/**
 * Serialize a value to deterministic JSON with sorted object keys.
 * Used for hashing, comparison, and artifact output.
 */
export const toCanonicalJson = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, currentValue) => {
      if (currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)) {
        return Object.keys(currentValue)
          .sort()
          .reduce<Record<string, unknown>>((accumulator, key) => {
            accumulator[key] = (currentValue as Record<string, unknown>)[key];
            return accumulator;
          }, {});
      }

      return currentValue;
    },
    2,
  );

/** Check if a field kind is primitive (no nested fields or special compilation). */
export const isPrimitiveFieldKind = (kind: FieldKind): boolean =>
  ["text", "number", "boolean", "date", "json", "enum", "file", "link", "markdown", "rich_text", "json_rte"].includes(kind);
