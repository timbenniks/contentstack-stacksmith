import { describe, expect, it } from "vitest";

import type * as core from "@timbenniks/contentstack-stacksmith-core";

import type * as dsl from "../src/public-types.js";

/**
 * Drift detection between dsl/public-types.ts and core/schema/types.ts.
 *
 * The public dsl package re-declares types rather than importing from core
 * (core is a devDependency, not a runtime dep, to keep the published package
 * self-contained). This creates risk of accidental drift.
 *
 * This test asserts at compile time that every DSL type is structurally
 * assignable to its core counterpart — dsl must be a subset of core.
 * The reverse is allowed to differ (core can carry diffing-only extras like
 * `previousUid` on fields and `rename_field` in OperationKind).
 *
 * When this test fails to compile, drift has been introduced. Fix by syncing
 * the two files or by extending the exception list below with a comment
 * explaining the intentional divergence.
 */

type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;

// Every line below is an assertion: if the dsl type drifts away from core's
// shape, tsc will fail here. Keep this list in sync with the exported shape types.
// The underscore prefix exempts these from the unused-vars rule.
type _TaxonomyRef = Assert<IsAssignable<dsl.TaxonomyRef, core.TaxonomyRef>>;
type _EnumChoiceAdvanced = Assert<IsAssignable<dsl.EnumChoiceAdvanced, core.EnumChoiceAdvanced>>;
type _ContentTypeOptions = Assert<IsAssignable<dsl.ContentTypeOptions, core.ContentTypeOptions>>;
type _EntityRef = Assert<IsAssignable<dsl.EntityRef, core.EntityRef>>;
type _DependencyRef = Assert<IsAssignable<dsl.DependencyRef, core.DependencyRef>>;
type _NormalizedMetadata = Assert<IsAssignable<dsl.NormalizedMetadata, core.NormalizedMetadata>>;
type _CompiledBlock = Assert<IsAssignable<dsl.CompiledBlock, core.CompiledBlock>>;
type _NormalizableBlockInput = Assert<IsAssignable<dsl.NormalizableBlockInput, core.NormalizableBlockInput>>;
type _NormalizableFieldInput = Assert<IsAssignable<dsl.NormalizableFieldInput, core.NormalizableFieldInput>>;
type _CompiledField = Assert<IsAssignable<dsl.CompiledField, core.CompiledField>>;
type _CompiledEntity = Assert<IsAssignable<dsl.CompiledEntity, core.CompiledEntity>>;
type _CompiledContentType = Assert<IsAssignable<dsl.CompiledContentType, core.CompiledContentType>>;
type _CompiledGlobalField = Assert<IsAssignable<dsl.CompiledGlobalField, core.CompiledGlobalField>>;
type _SchemaArtifact = Assert<IsAssignable<dsl.SchemaArtifact, core.SchemaArtifact>>;
type _OperationKind = Assert<IsAssignable<dsl.OperationKind, core.OperationKind>>;
type _RiskLevel = Assert<IsAssignable<dsl.RiskLevel, core.RiskLevel>>;
type _DiffChange = Assert<IsAssignable<dsl.DiffChange, core.DiffChange>>;
type _PlanRisk = Assert<IsAssignable<dsl.PlanRisk, core.PlanRisk>>;
type _PlanOperation = Assert<IsAssignable<dsl.PlanOperation, core.PlanOperation>>;
type _DiffResult = Assert<IsAssignable<dsl.DiffResult, core.DiffResult>>;
type _DependencyGraph = Assert<IsAssignable<dsl.DependencyGraph, core.DependencyGraph>>;
type _ValidationFinding = Assert<IsAssignable<dsl.ValidationFinding, core.ValidationFinding>>;
type _PlanSummary = Assert<IsAssignable<dsl.PlanSummary, core.PlanSummary>>;
type _PlanArtifact = Assert<IsAssignable<dsl.PlanArtifact, core.PlanArtifact>>;
type _OrgAuditFinding = Assert<IsAssignable<dsl.OrgAuditFinding, core.OrgAuditFinding>>;
type _OrgAuditSummary = Assert<IsAssignable<dsl.OrgAuditSummary, core.OrgAuditSummary>>;
type _OrgAuditFeatureSummary = Assert<IsAssignable<dsl.OrgAuditFeatureSummary, core.OrgAuditFeatureSummary>>;
type _OrgUsageMetric = Assert<IsAssignable<dsl.OrgUsageMetric, core.OrgUsageMetric>>;
type _StackUsageRow = Assert<IsAssignable<dsl.StackUsageRow, core.StackUsageRow>>;
type _OrgUsageSnapshot = Assert<IsAssignable<dsl.OrgUsageSnapshot, core.OrgUsageSnapshot>>;
type _OrgAuditReport = Assert<IsAssignable<dsl.OrgAuditReport, core.OrgAuditReport>>;
type _SchemaInput = Assert<IsAssignable<dsl.SchemaInput, core.SchemaInput>>;

describe("dsl ↔ core type compatibility", () => {
  it("dsl public types are structurally assignable to core types (enforced at compile time)", () => {
    // If the `Assert<...>` lines above fail to compile, drift has been introduced.
    // This runtime assertion exists only so vitest registers the test.
    expect(true).toBe(true);
  });

  it("SCHEMA_VERSION is equal between dsl and core", async () => {
    const dslConst = (await import("../src/public-types.js")).SCHEMA_VERSION;
    const coreConst = (await import("@timbenniks/contentstack-stacksmith-core")).SCHEMA_VERSION;
    expect(dslConst).toBe(coreConst);
  });
});
