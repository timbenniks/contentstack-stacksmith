import type { CompiledEntity, CompiledField, SchemaArtifact, ValidationFinding } from "@timbenniks/contentstack-stacksmith-core";

const duplicateFinding = (message: string, entityId?: string, fieldId?: string): ValidationFinding => ({
  level: "blocker",
  code: "DUPLICATE_UID",
  message,
  entityId,
  fieldId,
});

const validateFields = (
  fields: CompiledField[],
  entity: CompiledEntity,
  schema: SchemaArtifact,
  findings: ValidationFinding[],
  parentPath: string,
): void => {
  const fieldIds = new Set<string>();

  for (const field of fields) {
    if (fieldIds.has(field.uid)) {
      findings.push(duplicateFinding(`Duplicate field uid ${field.uid} on ${entity.uid} (at ${parentPath}).`, entity.id, field.id));
    }
    fieldIds.add(field.uid);

    if (field.kind === "reference") {
      for (const target of field.referenceTo ?? []) {
        if (!schema.entities.some((candidate) => candidate.kind === "content_type" && candidate.uid === target)) {
          findings.push({
            level: "blocker",
            code: "MISSING_REFERENCE_TARGET",
            message: `${entity.uid}.${field.uid} references missing content type ${target}.`,
            entityId: entity.id,
            fieldId: field.id,
          });
        }
      }
    }

    if (field.kind === "global_field" && field.globalFieldRef) {
      if (!schema.entities.some((candidate) => candidate.kind === "global_field" && candidate.uid === field.globalFieldRef)) {
        findings.push({
          level: "blocker",
          code: "MISSING_GLOBAL_FIELD",
          message: `${entity.uid}.${field.uid} depends on missing global field ${field.globalFieldRef}.`,
          entityId: entity.id,
          fieldId: field.id,
        });
      }
    }

    if (field.kind === "modular_blocks" && (!field.blocks || field.blocks.length === 0)) {
      findings.push({
        level: "medium",
        code: "EMPTY_MODULAR_BLOCKS",
        message: `${entity.uid}.${field.uid} defines modular blocks without any blocks.`,
        entityId: entity.id,
        fieldId: field.id,
      });
    }

    if (field.fields && field.fields.length > 0) {
      validateFields(field.fields, entity, schema, findings, `${parentPath}.${field.uid}`);
    }

    if (field.blocks) {
      for (const block of field.blocks) {
        if (block.globalFieldRef) {
          if (!schema.entities.some((candidate) => candidate.kind === "global_field" && candidate.uid === block.globalFieldRef)) {
            findings.push({
              level: "blocker",
              code: "MISSING_GLOBAL_FIELD",
              message: `${entity.uid}.${field.uid}.${block.uid} embeds missing global field ${block.globalFieldRef}.`,
              entityId: entity.id,
              fieldId: field.id,
            });
          }
          continue;
        }

        if (block.fields) {
          validateFields(block.fields, entity, schema, findings, `${parentPath}.${field.uid}.${block.uid}`);
        }
      }
    }
  }
};

export const validateSchema = (schema: SchemaArtifact): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];
  const entityIds = new Set<string>();

  for (const entity of schema.entities) {
    if (entityIds.has(entity.id)) {
      findings.push(duplicateFinding(`Duplicate entity uid detected for ${entity.uid}.`, entity.id));
    }
    entityIds.add(entity.id);

    validateFields(entity.fields, entity, schema, findings, entity.uid);

    if (entity.kind === "content_type") {
      const titleField = entity.fields.find((field) => field.uid === "title");
      if (!titleField) {
        findings.push({
          level: "blocker",
          code: "MISSING_TITLE_FIELD",
          message: `Content type ${entity.uid} is missing a required "title" field. Contentstack requires every content type to have a title field.`,
          entityId: entity.id,
        });
      } else if (!titleField.required) {
        findings.push({
          level: "high",
          code: "TITLE_FIELD_NOT_REQUIRED",
          message: `Content type ${entity.uid} has a "title" field that is not marked as required. Contentstack enforces this as mandatory.`,
          entityId: entity.id,
          fieldId: titleField.id,
        });
      }
    }
  }

  return findings;
};
