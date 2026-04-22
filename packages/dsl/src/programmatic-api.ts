import {
  buildDependencyGraph as buildDependencyGraphInternal,
  createPlan as createPlanInternal,
  diffSchemas as diffSchemasInternal,
  isPrimitiveFieldKind as isPrimitiveFieldKindInternal,
  normalizeSchema as normalizeSchemaInternal,
  toCanonicalJson as toCanonicalJsonInternal,
} from "@timbenniks/contentstack-stacksmith-core";

import type {
  CompiledEntity,
  CompiledField,
  DependencyGraph,
  DiffResult,
  FieldKind,
  PlanArtifact,
  SchemaArtifact,
  SchemaInput,
  ValidationFinding,
} from "./public-types.js";

export const normalizeSchema: (input: SchemaInput | SchemaArtifact) => SchemaArtifact = (input) =>
  normalizeSchemaInternal(input as Parameters<typeof normalizeSchemaInternal>[0]) as SchemaArtifact;

export const toCanonicalJson: (value: unknown) => string = (value) => toCanonicalJsonInternal(value);

export const isPrimitiveFieldKind: (kind: FieldKind) => boolean = (kind) => isPrimitiveFieldKindInternal(kind);

export const buildDependencyGraph: (schema: SchemaArtifact) => DependencyGraph = (schema) =>
  buildDependencyGraphInternal(schema as Parameters<typeof buildDependencyGraphInternal>[0]) as DependencyGraph;

export const diffSchemas: (localInput: SchemaArtifact, remoteInput?: SchemaArtifact) => DiffResult = (
  localInput,
  remoteInput,
) =>
  diffSchemasInternal(
    localInput as Parameters<typeof diffSchemasInternal>[0],
    remoteInput as Parameters<typeof diffSchemasInternal>[1],
  ) as DiffResult;

export const createPlan: (
  diff: DiffResult,
  graph?: DependencyGraph,
  validationFindings?: ValidationFinding[],
) => PlanArtifact = (diff, graph, validationFindings) =>
  createPlanInternal(
    diff as Parameters<typeof createPlanInternal>[0],
    graph as Parameters<typeof createPlanInternal>[1],
    validationFindings as Parameters<typeof createPlanInternal>[2],
  ) as PlanArtifact;

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

const blockedKinds = new Set<DiffResult["operations"][number]["kind"]>(["delete_entity", "remove_field"]);

export const validateDiff = (diff: DiffResult): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];

  for (const operation of diff.operations) {
    if (blockedKinds.has(operation.kind)) {
      findings.push({
        level: "blocker",
        code: "DESTRUCTIVE_CHANGE",
        message: `${operation.summary} is blocked in phase 1 because it can destroy remote data.`,
        entityId: operation.entity.id,
        fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
        operationId: operation.id,
      });
      continue;
    }

    if (operation.kind === "update_field") {
      const kindChange = operation.details.find((detail) => detail.path.endsWith(".kind"));
      const requiredTightening = operation.details.find(
        (detail) => detail.path.endsWith(".required") && detail.before === false && detail.after === true,
      );
      const uniqueTightening = operation.details.find(
        (detail) => detail.path.endsWith(".unique") && detail.before === false && detail.after === true,
      );
      const multipleReduction = operation.details.find(
        (detail) => detail.path.endsWith(".multiple") && detail.before === true && detail.after === false,
      );
      const enumChoicesNarrowing = operation.details.find((detail) => {
        if (!detail.path.endsWith(".enumChoices")) return false;
        const before = Array.isArray(detail.before) ? detail.before as string[] : [];
        const after = Array.isArray(detail.after) ? detail.after as string[] : [];
        return before.some((choice) => !after.includes(choice));
      });
      const globalFieldRefChange = operation.details.find((detail) => detail.path.endsWith(".globalFieldRef"));
      const referenceTargetNarrowing = operation.details.find((detail) => {
        if (!detail.path.endsWith(".referenceTo")) return false;
        const before = Array.isArray(detail.before) ? detail.before as string[] : [];
        const after = Array.isArray(detail.after) ? detail.after as string[] : [];
        return before.some((ref) => !after.includes(ref));
      });

      if (kindChange || requiredTightening || uniqueTightening || multipleReduction || enumChoicesNarrowing || globalFieldRefChange || referenceTargetNarrowing) {
        findings.push({
          level: "blocker",
          code: "BREAKING_FIELD_MUTATION",
          message: `${operation.summary} is blocked because it changes field shape or validation in a breaking way.`,
          entityId: operation.entity.id,
          fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
          operationId: operation.id,
        });
      } else {
        findings.push({
          level: "low",
          code: "SAFE_FIELD_UPDATE",
          message: `${operation.summary} is classified as a low-risk field update.`,
          entityId: operation.entity.id,
          fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
          operationId: operation.id,
        });
      }
    }

    if (operation.kind === "add_field") {
      const fieldSnapshot = operation.details[0]?.after as { required?: boolean } | undefined;
      findings.push({
        level: fieldSnapshot?.required ? "high" : "low",
        code: fieldSnapshot?.required ? "RISKY_REQUIRED_FIELD" : "SAFE_ADDITIVE_CHANGE",
        message: fieldSnapshot?.required
          ? `${operation.summary} adds a required field and needs future migration support.`
          : `${operation.summary} is a safe additive field change.`,
        entityId: operation.entity.id,
        fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
        operationId: operation.id,
      });
    }

    if (operation.kind === "create_entity" || operation.kind === "update_entity" || operation.kind === "reorder_fields") {
      findings.push({
        level: "low",
        code: "SAFE_ENTITY_CHANGE",
        message: `${operation.summary} is safe to apply in phase 1.`,
        entityId: operation.entity.id,
        operationId: operation.id,
      });
    }
  }

  return findings;
};

export const analyzePlanRisk = (plan: PlanArtifact): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];

  if (plan.summary.blocked > 0) {
    findings.push({
      level: "blocker",
      code: "PLAN_BLOCKED",
      message: `Plan contains ${plan.summary.blocked} blocked operation(s).`,
    });
  }

  if (plan.summary.highRisk > 0) {
    findings.push({
      level: "high",
      code: "HIGH_RISK_OPERATIONS",
      message: `Plan contains ${plan.summary.highRisk} high-risk operation(s).`,
    });
  }

  if (plan.summary.mediumRisk > 0) {
    findings.push({
      level: "medium",
      code: "MEDIUM_RISK_OPERATIONS",
      message: `Plan contains ${plan.summary.mediumRisk} medium-risk operation(s).`,
    });
  }

  return findings;
};
