import { normalizeSchema, toCanonicalJson } from "../normalize/normalize-schema.js";
import type {
  CompiledEntity,
  CompiledField,
  DiffChange,
  DiffResult,
  EntityRef,
  PlanOperation,
  SchemaArtifact,
} from "../schema/types.js";

const mapEntities = (schema: SchemaArtifact): Map<string, CompiledEntity> =>
  new Map(schema.entities.map((entity) => [entity.id, entity]));

const mapFields = (entity: CompiledEntity): Map<string, CompiledField> =>
  new Map(entity.fields.map((field) => [field.uid, field]));

const entityRef = (entity: CompiledEntity): EntityRef => ({ id: entity.id, kind: entity.kind, uid: entity.uid });

const operation = (
  id: string,
  kind: PlanOperation["kind"],
  entity: EntityRef,
  summary: string,
  details: DiffChange[],
  fieldUid?: string,
): PlanOperation => ({
  id,
  kind,
  entity,
  fieldUid,
  status: "pending",
  summary,
  details,
  dependencies: [],
  risks: [],
});

const entityChanged = (left: CompiledEntity, right: CompiledEntity): DiffChange[] => {
  const changes: DiffChange[] = [];

  if (left.title !== right.title) {
    changes.push({ path: "title", before: right.title, after: left.title, message: "Title changed" });
  }

  if ((left.description ?? "") !== (right.description ?? "")) {
    changes.push({
      path: "description",
      before: right.description,
      after: left.description,
      message: "Description changed",
    });
  }

  const leftOptions = "options" in left ? (left as CompiledEntity & { options?: Record<string, unknown> }).options : undefined;
  const rightOptions = "options" in right ? (right as CompiledEntity & { options?: Record<string, unknown> }).options : undefined;
  if (toCanonicalJson(leftOptions ?? {}) !== toCanonicalJson(rightOptions ?? {})) {
    changes.push({
      path: "options",
      before: rightOptions,
      after: leftOptions,
      message: "Content type options changed",
    });
  }

  return changes;
};

const fieldChanged = (left: CompiledField, right: CompiledField): DiffChange[] => {
  const changes: DiffChange[] = [];

  const comparableKeys: Array<keyof CompiledField> = [
    "displayName",
    "kind",
    "required",
    "unique",
    "multiple",
    "nonLocalizable",
    "defaultValue",
    "enumChoices",
    "enumAdvanced",
    "minInstance",
    "maxInstance",
    "referenceTo",
    "refMultipleContentTypes",
    "globalFieldRef",
    "richTextType",
    "plugins",
    "taxonomies",
    "format",
    "errorMessages",
    "multiline",
    "displayType",
    "startDate",
    "endDate",
    "extensions",
  ];

  for (const key of comparableKeys) {
    if (toCanonicalJson(left[key]) !== toCanonicalJson(right[key])) {
      changes.push({
        path: `fields.${left.uid}.${key}`,
        before: right[key],
        after: left[key],
        message: `Field ${left.uid} changed property ${key}`,
      });
    }
  }

  if ((left.order ?? 0) !== (right.order ?? 0)) {
    changes.push({
      path: `fields.${left.uid}.order`,
      before: right.order,
      after: left.order,
      message: `Field ${left.uid} moved`,
    });
  }

  if (left.fields || right.fields) {
    const leftJson = toCanonicalJson(left.fields ?? []);
    const rightJson = toCanonicalJson(right.fields ?? []);
    if (leftJson !== rightJson) {
      changes.push({
        path: `fields.${left.uid}.fields`,
        before: right.fields,
        after: left.fields,
        message: `Field ${left.uid} has changed sub-fields`,
      });
    }
  }

  if (left.blocks || right.blocks) {
    const leftJson = toCanonicalJson(left.blocks ?? []);
    const rightJson = toCanonicalJson(right.blocks ?? []);
    if (leftJson !== rightJson) {
      changes.push({
        path: `fields.${left.uid}.blocks`,
        before: right.blocks,
        after: left.blocks,
        message: `Field ${left.uid} has changed blocks`,
      });
    }
  }

  return changes;
};

/**
 * Compare local and remote schemas to produce a list of migration operations.
 * Detects entity creates/deletes, field adds/removes/updates, and reordering.
 * @param localInput - The local (desired) schema
 * @param remoteInput - The remote (current) schema; empty schema if omitted
 * @returns Diff result with operations, local/remote schemas, and warnings
 */
export const diffSchemas = (localInput: SchemaArtifact, remoteInput?: SchemaArtifact): DiffResult => {
  const local = normalizeSchema(localInput);
  const remote = remoteInput ? normalizeSchema(remoteInput) : normalizeSchema({ schemaVersion: 1, entities: [], metadata: {} });
  const localEntities = mapEntities(local);
  const remoteEntities = mapEntities(remote);
  const operations: PlanOperation[] = [];

  for (const localEntity of local.entities) {
    const existingEntity = remoteEntities.get(localEntity.id);

    if (!existingEntity) {
      operations.push(
        operation(
          `create:${localEntity.id}`,
          "create_entity",
          entityRef(localEntity),
          `Create ${localEntity.kind.replace("_", " ")} ${localEntity.uid}`,
          [{ path: localEntity.id, after: localEntity, message: "Entity will be created" }],
        ),
      );
      continue;
    }

    const entityChanges = entityChanged(localEntity, existingEntity);
    if (entityChanges.length > 0) {
      operations.push(
        operation(
          `update:${localEntity.id}`,
          "update_entity",
          entityRef(localEntity),
          `Update ${localEntity.kind.replace("_", " ")} ${localEntity.uid}`,
          entityChanges,
        ),
      );
    }

    const localFields = mapFields(localEntity);
    const remoteFields = mapFields(existingEntity);

    // Pre-scan: map each local field's declared previousUid to the new uid.
    // A rename covers both sides: the remote's "old" uid is considered consumed
    // by the rename, and the local's "new" uid is considered a rename, not an add.
    const renames = new Map<string, CompiledField>(); // previousUid -> localField
    for (const localField of localEntity.fields) {
      if (localField.previousUid) {
        renames.set(localField.previousUid, localField);
      }
    }

    for (const localField of localEntity.fields) {
      // Rename path: this local field declares a previousUid.
      if (localField.previousUid) {
        const oldRemote = remoteFields.get(localField.previousUid);
        const newRemote = remoteFields.get(localField.uid);

        if (newRemote && oldRemote) {
          // Botched prior state: both old and new uids already exist remotely.
          operations.push(
            operation(
              `rename-field:${localEntity.id}:${localField.uid}`,
              "rename_field",
              entityRef(localEntity),
              `Rename blocked: both "${localField.previousUid}" and "${localField.uid}" already exist on ${localEntity.uid}`,
              [
                {
                  path: localField.id,
                  before: oldRemote,
                  after: localField,
                  message: `Cannot rename ${localField.previousUid} → ${localField.uid}: both uids already exist on the remote. Remove one manually before re-running.`,
                },
              ],
              localField.uid,
            ),
          );
          continue;
        }

        if (oldRemote) {
          // Happy rename path.
          const renameChanges: DiffChange[] = [
            {
              path: `fields.${localField.uid}.uid`,
              before: localField.previousUid,
              after: localField.uid,
              message: `Field rename: ${localField.previousUid} → ${localField.uid}`,
            },
            ...fieldChanged(localField, { ...oldRemote, uid: localField.uid }),
          ];
          operations.push(
            operation(
              `rename-field:${localEntity.id}:${localField.uid}`,
              "rename_field",
              entityRef(localEntity),
              `Rename field ${localField.previousUid} → ${localField.uid} in ${localEntity.uid}`,
              renameChanges,
              localField.uid,
            ),
          );
          continue;
        }

        // previousUid declared but the old field does not exist remotely — fall through
        // to the normal add_field path. (Happens on fresh stacks or after a prior rename
        // has already succeeded; the previousUid is now vestigial.)
      }

      const remoteField = remoteFields.get(localField.uid);

      if (!remoteField) {
        operations.push(
          operation(
            `add-field:${localEntity.id}:${localField.uid}`,
            "add_field",
            entityRef(localEntity),
            `Add field ${localField.uid} to ${localEntity.uid}`,
            [{ path: localField.id, after: localField, message: "Field will be added" }],
            localField.uid,
          ),
        );
        continue;
      }

      const fieldChanges = fieldChanged(localField, remoteField);
      const reorderedOnly = fieldChanges.length > 0 && fieldChanges.every((change) => change.path.endsWith(".order"));

      if (fieldChanges.length > 0) {
        operations.push(
          operation(
            `${reorderedOnly ? "reorder-fields" : "update-field"}:${localEntity.id}:${localField.uid}`,
            reorderedOnly ? "reorder_fields" : "update_field",
            entityRef(localEntity),
            `${reorderedOnly ? "Reorder" : "Update"} field ${localField.uid} in ${localEntity.uid}`,
            fieldChanges,
            localField.uid,
          ),
        );
      }
    }

    for (const remoteField of existingEntity.fields) {
      // Skip remote fields that have been consumed by a rename, and skip remote fields
      // whose uid was successfully renamed in a prior run (local still has the new uid).
      if (localFields.has(remoteField.uid)) continue;
      if (renames.has(remoteField.uid)) continue;

      operations.push(
        operation(
          `remove-field:${existingEntity.id}:${remoteField.uid}`,
          "remove_field",
          entityRef(existingEntity),
          `Remove field ${remoteField.uid} from ${existingEntity.uid}`,
          [{ path: remoteField.id, before: remoteField, message: "Field will be removed" }],
          remoteField.uid,
        ),
      );
    }
  }

  for (const remoteEntity of remote.entities) {
    if (!localEntities.has(remoteEntity.id)) {
      operations.push(
        operation(
          `delete:${remoteEntity.id}`,
          "delete_entity",
          entityRef(remoteEntity),
          `Delete ${remoteEntity.kind.replace("_", " ")} ${remoteEntity.uid}`,
          [{ path: remoteEntity.id, before: remoteEntity, message: "Entity will be deleted" }],
        ),
      );
    }
  }

  return {
    local,
    remote,
    operations,
    warnings: [],
  };
};
