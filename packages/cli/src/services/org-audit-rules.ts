import type { CompiledField, OrgAuditFinding, SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

import { countEntitiesByKind, forEachField, hasFieldKind, walkFields } from "./schema-traversal.js";

/**
 * Canonical names of feature UIDs we read from `organization.plan.features`.
 *
 * Rules fail soft (return undefined) when a uid is absent, so stale keys produce
 * no findings rather than false positives; the `UNRECOGNIZED_PLAN_SHAPE` canary
 * in `OrgAuditService` fires when the whole response shape stops making sense.
 */
export const PLAN_KEYS = {
  content_types: "content_types",
  global_fields: "global_fields",
  max_fields_per_content_type: "maxFieldsLimit",
  max_content_types_per_reference_field: "maxContentTypesPerReferenceField",
  max_modular_blocks_per_content_type: "maxDynamicBlocksPerContentType",
  max_blocks_per_modular_blocks_field: "maxDynamicBlockObjects",
  max_modular_block_definitions: "maxDynamicBlockDefinations",
  max_modular_blocks_nesting_depth: "maxDynamicBlocksNestingDepth",
  max_taxonomies_per_content_type: "max_taxonomies_per_content_type",
  max_content_types_per_json_rte: "maxContentTypesPerJsonRte",
  max_content_types_per_rich_text_field: "maxContentTypesPerRichTextField",
  taxonomy: "taxonomy",
  branches: "branches",
} as const;

export interface PlanFeature {
  uid: string;
  name?: string | undefined;
  enabled: boolean;
  limit: number;
  max_limit?: number | undefined;
}

export interface OrgPlanShape {
  name: string;
  planId: string;
  features: Record<string, PlanFeature>;
}

export type AuditRule = (plan: OrgPlanShape, localSchema?: SchemaArtifact) => OrgAuditFinding | undefined;

interface Measurement {
  count: number;
  entityUid?: string | undefined;
  fieldUid?: string | undefined;
}

/**
 * Factory for the "does the local DSL fit within this plan limit?" rule shape.
 *
 * Every numeric-limit rule follows the same three-branch structure:
 *   - feature missing from plan response → undefined (don't emit false positives)
 *   - no local schema → informational note about the plan's limit
 *   - local over limit → blocker; else informational "you're within bounds"
 *
 * The factory parameterizes the three pieces that vary: which feature key, how
 * to measure the local schema, and how to describe location + remediation.
 */
const numericLimitRule = (config: {
  planKey: keyof typeof PLAN_KEYS;
  capability: string;
  codes: { limit: string; exceeded: string; ok: string };
  measure: (schema: SchemaArtifact) => Measurement;
  locationHint: (m: Measurement) => string;
  remediation: (m: Measurement, feature: PlanFeature) => string;
}): AuditRule => (plan, localSchema) => {
  const feature = plan.features[PLAN_KEYS[config.planKey]];
  if (!feature) return undefined;

  const featureName = feature.name ?? config.capability;

  if (!localSchema) {
    return {
      level: "low",
      code: config.codes.limit,
      capability: config.capability,
      message: `Plan allows up to ${feature.limit} ${featureName}.`,
      planValue: feature.limit,
    };
  }

  const m = config.measure(localSchema);
  if (m.count > feature.limit) {
    return {
      level: "blocker",
      code: config.codes.exceeded,
      capability: config.capability,
      message: `${config.locationHint(m)} exceeds plan limit for ${featureName}: local uses ${m.count}, plan allows ${feature.limit}.`,
      planValue: feature.limit,
      localValue: m.count,
      remediation: config.remediation(m, feature),
    };
  }

  return {
    level: "low",
    code: config.codes.ok,
    capability: config.capability,
    message: `${m.count}/${feature.limit} ${featureName} used.`,
    planValue: feature.limit,
    localValue: m.count,
  };
};

// ---------- Measurements ----------

const measureContentTypes = (schema: SchemaArtifact): Measurement => ({
  count: countEntitiesByKind(schema, "content_type"),
});

const measureGlobalFields = (schema: SchemaArtifact): Measurement => ({
  count: countEntitiesByKind(schema, "global_field"),
});

const measureMaxFieldsPerContentType = (schema: SchemaArtifact): Measurement => {
  let best: Measurement = { count: 0 };
  for (const entity of schema.entities) {
    if (entity.kind !== "content_type") continue;
    if (entity.fields.length > best.count) best = { count: entity.fields.length, entityUid: entity.uid };
  }
  return best;
};

const measureMaxReferenceTargets = (schema: SchemaArtifact): Measurement => {
  let best: Measurement = { count: 0 };
  forEachField(schema, (field, entityUid) => {
    if (field.kind !== "reference") return;
    const count = field.referenceTo?.length ?? 0;
    if (count > best.count) best = { count, entityUid, fieldUid: field.uid };
  });
  return best;
};

const measureMaxModularBlocksPerContentType = (schema: SchemaArtifact): Measurement => {
  let best: Measurement = { count: 0 };
  for (const entity of schema.entities) {
    if (entity.kind !== "content_type") continue;
    let count = 0;
    walkFields(entity.fields, (field) => {
      if (field.kind === "modular_blocks") count++;
    });
    if (count > best.count) best = { count, entityUid: entity.uid };
  }
  return best;
};

const measureMaxBlocksPerModularBlocksField = (schema: SchemaArtifact): Measurement => {
  let best: Measurement = { count: 0 };
  forEachField(schema, (field, entityUid) => {
    if (field.kind !== "modular_blocks") return;
    const count = field.blocks?.length ?? 0;
    if (count > best.count) best = { count, entityUid, fieldUid: field.uid };
  });
  return best;
};

const modularBlocksNestingDepth = (fields: CompiledField[] | undefined): number => {
  if (!fields) return 0;
  let max = 0;
  for (const field of fields) {
    if (field.kind === "modular_blocks") {
      for (const block of field.blocks ?? []) {
        const nested = 1 + modularBlocksNestingDepth(block.fields);
        if (nested > max) max = nested;
      }
    }
    if (field.kind === "group") {
      const nested = modularBlocksNestingDepth(field.fields);
      if (nested > max) max = nested;
    }
  }
  return max;
};

const measureMaxModularBlocksNestingDepth = (schema: SchemaArtifact): Measurement => {
  let depth = 0;
  for (const entity of schema.entities) {
    const entityDepth = modularBlocksNestingDepth(entity.fields);
    if (entityDepth > depth) depth = entityDepth;
  }
  return { count: depth };
};

const measureMaxTaxonomiesPerContentType = (schema: SchemaArtifact): Measurement => {
  let best: Measurement = { count: 0 };
  for (const entity of schema.entities) {
    if (entity.kind !== "content_type") continue;
    let count = 0;
    walkFields(entity.fields, (field) => {
      if (field.kind === "taxonomy") count++;
    });
    if (count > best.count) best = { count, entityUid: entity.uid };
  }
  return best;
};

const measureReferenceTargetsByKind = (schema: SchemaArtifact, kind: CompiledField["kind"]): Measurement => {
  let best: Measurement = { count: 0 };
  forEachField(schema, (field, entityUid) => {
    if (field.kind !== kind) return;
    const count = field.referenceTo?.length ?? 0;
    if (count > best.count) best = { count, entityUid, fieldUid: field.uid };
  });
  return best;
};

// ---------- Numeric-limit rules ----------

export const checkContentTypes = numericLimitRule({
  planKey: "content_types",
  capability: "content_types",
  codes: { limit: "CONTENT_TYPES_LIMIT", exceeded: "MAX_CONTENT_TYPES_EXCEEDED", ok: "CONTENT_TYPES_OK" },
  measure: measureContentTypes,
  locationHint: () => "Total content types",
  remediation: (m, feature) => `Remove ${m.count - feature.limit} content type(s), or upgrade to a plan with a higher content_types limit.`,
});

export const checkGlobalFields = numericLimitRule({
  planKey: "global_fields",
  capability: "global_fields",
  codes: { limit: "GLOBAL_FIELDS_LIMIT", exceeded: "MAX_GLOBAL_FIELDS_EXCEEDED", ok: "GLOBAL_FIELDS_OK" },
  measure: measureGlobalFields,
  locationHint: () => "Total global fields",
  remediation: (m, feature) => `Remove ${m.count - feature.limit} global field(s), or upgrade your plan.`,
});

export const checkMaxFieldsPerContentType = numericLimitRule({
  planKey: "max_fields_per_content_type",
  capability: "max_fields_per_content_type",
  codes: { limit: "MAX_FIELDS_PER_CONTENT_TYPE_LIMIT", exceeded: "MAX_FIELDS_PER_CONTENT_TYPE_EXCEEDED", ok: "MAX_FIELDS_PER_CONTENT_TYPE_OK" },
  measure: measureMaxFieldsPerContentType,
  locationHint: (m) => `Content type ${m.entityUid ?? "<unknown>"}`,
  remediation: (m) => `Split ${m.entityUid ?? "the content type"} into smaller types, or upgrade your plan.`,
});

export const checkMaxContentTypesPerReferenceField = numericLimitRule({
  planKey: "max_content_types_per_reference_field",
  capability: "max_content_types_per_reference_field",
  codes: { limit: "MAX_CTS_PER_REF_LIMIT", exceeded: "MAX_CTS_PER_REF_EXCEEDED", ok: "MAX_CTS_PER_REF_OK" },
  measure: measureMaxReferenceTargets,
  locationHint: (m) => `reference field ${m.entityUid ?? "?"}.${m.fieldUid ?? "?"}`,
  remediation: (m, feature) => `Reduce the number of content types in reference('${m.fieldUid ?? "?"}', { to: [...] }) below ${feature.limit}.`,
});

export const checkMaxModularBlocksPerContentType = numericLimitRule({
  planKey: "max_modular_blocks_per_content_type",
  capability: "max_modular_blocks_per_content_type",
  codes: { limit: "MAX_MB_PER_CT_LIMIT", exceeded: "MAX_MB_PER_CT_EXCEEDED", ok: "MAX_MB_PER_CT_OK" },
  measure: measureMaxModularBlocksPerContentType,
  locationHint: (m) => `Content type ${m.entityUid ?? "<unknown>"}`,
  remediation: (m, feature) => `Reduce the number of modular_blocks fields in ${m.entityUid ?? "the content type"} below ${feature.limit}.`,
});

export const checkMaxBlocksPerModularBlocksField = numericLimitRule({
  planKey: "max_blocks_per_modular_blocks_field",
  capability: "max_blocks_per_modular_blocks_field",
  codes: { limit: "MAX_BLOCKS_PER_MB_LIMIT", exceeded: "MAX_BLOCKS_PER_MB_EXCEEDED", ok: "MAX_BLOCKS_PER_MB_OK" },
  measure: measureMaxBlocksPerModularBlocksField,
  locationHint: (m) => `modularBlocks field ${m.entityUid ?? "?"}.${m.fieldUid ?? "?"}`,
  remediation: (m, feature) => `Reduce blocks[] length below ${feature.limit} on ${m.entityUid ?? "?"}.${m.fieldUid ?? "?"}.`,
});

export const checkMaxModularBlocksNestingDepth = numericLimitRule({
  planKey: "max_modular_blocks_nesting_depth",
  capability: "max_modular_blocks_nesting_depth",
  codes: { limit: "MAX_MB_NESTING_LIMIT", exceeded: "MAX_MB_NESTING_EXCEEDED", ok: "MAX_MB_NESTING_OK" },
  measure: measureMaxModularBlocksNestingDepth,
  locationHint: () => "Modular blocks nesting",
  remediation: (_m, feature) => `Flatten nested modular_blocks deeper than ${feature.limit} levels.`,
});

export const checkMaxTaxonomiesPerContentType = numericLimitRule({
  planKey: "max_taxonomies_per_content_type",
  capability: "max_taxonomies_per_content_type",
  codes: { limit: "MAX_TAX_PER_CT_LIMIT", exceeded: "MAX_TAX_PER_CT_EXCEEDED", ok: "MAX_TAX_PER_CT_OK" },
  measure: measureMaxTaxonomiesPerContentType,
  locationHint: (m) => `Content type ${m.entityUid ?? "<unknown>"}`,
  remediation: (m, feature) => `Reduce taxonomy() fields in ${m.entityUid ?? "the content type"} below ${feature.limit}.`,
});

export const checkMaxContentTypesPerJsonRte = numericLimitRule({
  planKey: "max_content_types_per_json_rte",
  capability: "max_content_types_per_json_rte",
  codes: { limit: "MAX_CTS_PER_JSON_RTE_LIMIT", exceeded: "MAX_CTS_PER_JSON_RTE_EXCEEDED", ok: "MAX_CTS_PER_JSON_RTE_OK" },
  measure: (schema) => measureReferenceTargetsByKind(schema, "json_rte"),
  locationHint: (m) => `jsonRte field ${m.entityUid ?? "?"}.${m.fieldUid ?? "?"}`,
  remediation: (m, feature) => `Reduce referenceTo[] length on jsonRte('${m.fieldUid ?? "?"}') below ${feature.limit}.`,
});

// rich_text fields don't carry referenceTo on CompiledField today; most stacks configure this via extensions.
// Leave the rule in place for future-proofing; it currently returns "ok" unless referenceTo is populated.
export const checkMaxContentTypesPerRichTextField = numericLimitRule({
  planKey: "max_content_types_per_rich_text_field",
  capability: "max_content_types_per_rich_text_field",
  codes: { limit: "MAX_CTS_PER_RICH_TEXT_LIMIT", exceeded: "MAX_CTS_PER_RICH_TEXT_EXCEEDED", ok: "MAX_CTS_PER_RICH_TEXT_OK" },
  measure: (schema) => measureReferenceTargetsByKind(schema, "rich_text"),
  locationHint: (m) => `richText field ${m.entityUid ?? "?"}.${m.fieldUid ?? "?"}`,
  remediation: (m, feature) => `Reduce reference targets on richText('${m.fieldUid ?? "?"}') below ${feature.limit}.`,
});

// ---------- Feature availability rules ----------

/**
 * Taxonomy has a numeric limit (max taxonomies per stack) AND can be effectively
 * disabled by `enabled: false` or `limit: 0`. If the DSL defines taxonomy fields
 * but the plan doesn't include taxonomy, block. Otherwise the numeric limit
 * rules handle the finer-grained checks.
 */
export const checkTaxonomyAvailability: AuditRule = (plan, localSchema) => {
  const feature = plan.features[PLAN_KEYS.taxonomy];
  if (!feature) return undefined;
  const available = feature.enabled && feature.limit > 0;
  if (!localSchema) {
    return {
      level: "low",
      code: available ? "TAXONOMY_AVAILABLE" : "TAXONOMY_UNAVAILABLE",
      capability: "taxonomy",
      message: available
        ? `Taxonomy is available on your plan (up to ${feature.limit} taxonomies).`
        : "Taxonomy is not available on your plan.",
      planValue: feature.limit,
    };
  }
  if (!available && hasFieldKind(localSchema, "taxonomy")) {
    return {
      level: "blocker",
      code: "TAXONOMY_NOT_AVAILABLE",
      capability: "taxonomy",
      message: "Your plan does not include taxonomy, but your local DSL uses taxonomy() fields.",
      planValue: feature.limit,
      localValue: true,
      remediation: "Remove taxonomy() fields from your DSL, or upgrade your plan to include taxonomy.",
    };
  }
  return undefined;
};

/** Branches aren't declared in the DSL — this is always informational. */
export const checkBranches: AuditRule = (plan) => {
  const feature = plan.features[PLAN_KEYS.branches];
  if (!feature) return undefined;
  const available = feature.enabled && feature.limit > 0;
  return {
    level: "low",
    code: available ? "BRANCHES_AVAILABLE" : "BRANCHES_UNAVAILABLE",
    capability: "branches",
    message: available
      ? `Branches are available on your plan (up to ${feature.limit}).`
      : "Branches are not available on your plan.",
    planValue: feature.limit,
  };
};

export const rules: AuditRule[] = [
  checkContentTypes,
  checkGlobalFields,
  checkMaxFieldsPerContentType,
  checkMaxContentTypesPerReferenceField,
  checkMaxModularBlocksPerContentType,
  checkMaxBlocksPerModularBlocksField,
  checkMaxModularBlocksNestingDepth,
  checkMaxTaxonomiesPerContentType,
  checkMaxContentTypesPerJsonRte,
  checkMaxContentTypesPerRichTextField,
  checkTaxonomyAvailability,
  checkBranches,
];
