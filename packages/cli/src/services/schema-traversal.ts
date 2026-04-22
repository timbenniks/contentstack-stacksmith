import type { CompiledField, EntityKind, FieldKind, SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

export const walkFields = (
  fields: CompiledField[] | undefined,
  visitor: (field: CompiledField) => void,
): void => {
  if (!fields) return;
  for (const field of fields) {
    visitor(field);
    walkFields(field.fields, visitor);
    if (field.blocks) {
      for (const block of field.blocks) walkFields(block.fields, visitor);
    }
  }
};

export const forEachField = (
  schema: SchemaArtifact,
  visitor: (field: CompiledField, entityUid: string) => void,
): void => {
  for (const entity of schema.entities) {
    walkFields(entity.fields, (field) => visitor(field, entity.uid));
  }
};

export const hasFieldKind = (schema: SchemaArtifact, kind: FieldKind): boolean => {
  let found = false;
  forEachField(schema, (field) => {
    if (field.kind === kind) found = true;
  });
  return found;
};

export const countEntitiesByKind = (schema: SchemaArtifact, kind: EntityKind): number =>
  schema.entities.filter((entity) => entity.kind === kind).length;
