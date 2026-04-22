import { describe, expect, it } from "vitest";

import type { FieldKind } from "@timbenniks/contentstack-stacksmith-core";
import { createPlan, diffSchemas, normalizeSchema } from "@timbenniks/contentstack-stacksmith-core";

import { analyzePlanRisk, validateDiff, validateSchema } from "../src/index.js";

const simpleField = (uid: string, kind: FieldKind = "text", overrides: Record<string, unknown> = {}) => ({
  uid,
  displayName: uid,
  kind,
  required: false,
  unique: false,
  multiple: false,
  metadata: {},
  ...overrides,
});

const ctWithFields = (uid: string, fields: ReturnType<typeof simpleField>[]) => ({
  kind: "content_type" as const,
  uid,
  title: uid,
  metadata: {},
  fields,
});

describe("validate-schema (comprehensive)", () => {
  it("empty schema produces zero findings", () => {
    const schema = normalizeSchema({ entities: [], metadata: {} });
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it("catches duplicate entity IDs", () => {
    const schema = normalizeSchema({
      entities: [ctWithFields("page", [simpleField("title")])],
    });
    const duplicated = { ...schema, entities: [...schema.entities, ...schema.entities] };
    const findings = validateSchema(duplicated as any);
    expect(findings.some((f) => f.code === "DUPLICATE_UID")).toBe(true);
  });
});

describe("validate-diff (comprehensive)", () => {
  it("flags remove_field as destructive", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true })])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("old_field")])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "DESTRUCTIVE_CHANGE")).toBe(true);
  });

  it("flags field kind changes as breaking", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("data", "number")])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("data", "text")])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("flags required: false -> true as breaking", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("slug", "text", { required: true })])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("slug", "text", { required: false })])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("classifies create_entity as safe", () => {
    const local = normalizeSchema({ entities: [ctWithFields("ct", [simpleField("title")])], metadata: {} });
    const remote = normalizeSchema({ entities: [], metadata: {} });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "SAFE_ENTITY_CHANGE")).toBe(true);
  });

  it("classifies add_field with required: true as risky", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("new_field", "text", { required: true })])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true })])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "RISKY_REQUIRED_FIELD")).toBe(true);
  });

  it("classifies add_field with required: false as safe", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("optional_field")])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true })])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "SAFE_ADDITIVE_CHANGE")).toBe(true);
  });

  it("classifies reorder_fields as safe", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("a"), simpleField("b")])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("b"), simpleField("a")])],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "SAFE_ENTITY_CHANGE")).toBe(true);
  });

  it("empty operations produce zero findings", () => {
    const schema = normalizeSchema({ entities: [ctWithFields("ct", [simpleField("title")])], metadata: {} });
    const diff = diffSchemas(schema, schema);
    const findings = validateDiff(diff);
    expect(findings).toHaveLength(0);
  });
});

describe("analyze-plan-risk (comprehensive)", () => {
  it("safe plan produces zero findings", () => {
    const local = normalizeSchema({ entities: [ctWithFields("new_ct", [simpleField("title")])], metadata: {} });
    const remote = normalizeSchema({ entities: [], metadata: {} });
    const diff = diffSchemas(local, remote);
    const diffFindings = validateDiff(diff);
    const plan = createPlan(diff, undefined, diffFindings);
    const riskFindings = analyzePlanRisk(plan);
    expect(riskFindings.some((f) => f.level === "blocker")).toBe(false);
  });

  it("empty plan produces zero findings", () => {
    const schema = normalizeSchema({ entities: [ctWithFields("ct", [simpleField("title")])], metadata: {} });
    const diff = diffSchemas(schema, schema);
    const plan = createPlan(diff);
    const findings = analyzePlanRisk(plan);
    expect(findings).toHaveLength(0);
  });

  it("detects blocked operations", () => {
    const local = normalizeSchema({ entities: [], metadata: {} });
    const remote = normalizeSchema({ entities: [ctWithFields("ct", [simpleField("title")])], metadata: {} });
    const diff = diffSchemas(local, remote);
    const diffFindings = validateDiff(diff);
    const plan = createPlan(diff, undefined, diffFindings);
    const riskFindings = analyzePlanRisk(plan);
    expect(riskFindings.some((f) => f.code === "PLAN_BLOCKED")).toBe(true);
  });

  it("detects high-risk operations", () => {
    const local = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true }), simpleField("mandatory_new", "text", { required: true })])],
    });
    const remote = normalizeSchema({
      entities: [ctWithFields("ct", [simpleField("title", "text", { required: true })])],
    });
    const diff = diffSchemas(local, remote);
    const diffFindings = validateDiff(diff);
    const plan = createPlan(diff, undefined, diffFindings);
    const riskFindings = analyzePlanRisk(plan);
    expect(riskFindings.some((f) => f.code === "HIGH_RISK_OPERATIONS")).toBe(true);
  });
});
