import { expect } from "chai";

import type { SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

import {
  PLAN_KEYS,
  checkBranches,
  checkContentTypes,
  checkGlobalFields,
  checkMaxBlocksPerModularBlocksField,
  checkMaxContentTypesPerJsonRte,
  checkMaxContentTypesPerReferenceField,
  checkMaxContentTypesPerRichTextField,
  checkMaxFieldsPerContentType,
  checkMaxModularBlocksNestingDepth,
  checkMaxModularBlocksPerContentType,
  checkMaxTaxonomiesPerContentType,
  checkTaxonomyAvailability,
  type OrgPlanShape,
  type PlanFeature,
} from "../../lib/services/org-audit-rules";

const feature = (uid: string, limit: number, enabled = true): PlanFeature => ({
  uid,
  name: uid,
  enabled,
  limit,
  max_limit: limit,
});

const planWith = (...features: PlanFeature[]): OrgPlanShape => ({
  name: "Test Plan",
  planId: "test",
  features: Object.fromEntries(features.map((f) => [f.uid, f])),
});

const contentTypeEntity = (uid: string, fields: Array<Record<string, unknown>> = []): SchemaArtifact["entities"][number] =>
  ({
    id: `content_type:${uid}`,
    kind: "content_type",
    uid,
    title: uid,
    fields: fields as never,
    dependencies: [],
    metadata: { origin: "dsl" },
  }) as never;

const globalFieldEntity = (uid: string): SchemaArtifact["entities"][number] =>
  ({
    id: `global_field:${uid}`,
    kind: "global_field",
    uid,
    title: uid,
    fields: [],
    dependencies: [],
    metadata: { origin: "dsl" },
  }) as never;

const schemaOf = (entities: Array<SchemaArtifact["entities"][number]>): SchemaArtifact =>
  ({ schemaVersion: 1, entities, metadata: { origin: "dsl" } }) as never;

const makeField = (uid: string, kind: string, extras: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `field:${uid}`,
  uid,
  displayName: uid,
  kind,
  order: 0,
  required: false,
  unique: false,
  multiple: false,
  metadata: {},
  dependencies: [],
  ...extras,
});

describe("org-audit-rules", () => {
  describe("fail-soft on missing uids", () => {
    it("returns undefined for every rule when plan.features is empty", () => {
      const plan = planWith();
      const schema = schemaOf([contentTypeEntity("blog", [makeField("t", "taxonomy")])]);
      expect(checkContentTypes(plan, schema)).to.equal(undefined);
      expect(checkGlobalFields(plan, schema)).to.equal(undefined);
      expect(checkMaxFieldsPerContentType(plan, schema)).to.equal(undefined);
      expect(checkMaxContentTypesPerReferenceField(plan, schema)).to.equal(undefined);
      expect(checkMaxModularBlocksPerContentType(plan, schema)).to.equal(undefined);
      expect(checkMaxBlocksPerModularBlocksField(plan, schema)).to.equal(undefined);
      expect(checkMaxModularBlocksNestingDepth(plan, schema)).to.equal(undefined);
      expect(checkMaxTaxonomiesPerContentType(plan, schema)).to.equal(undefined);
      expect(checkMaxContentTypesPerJsonRte(plan, schema)).to.equal(undefined);
      expect(checkMaxContentTypesPerRichTextField(plan, schema)).to.equal(undefined);
      expect(checkTaxonomyAvailability(plan, schema)).to.equal(undefined);
      expect(checkBranches(plan, schema)).to.equal(undefined);
    });
  });

  describe("checkContentTypes", () => {
    it("emits a blocker when local count exceeds plan limit", () => {
      const plan = planWith(feature(PLAN_KEYS.content_types, 2));
      const schema = schemaOf([contentTypeEntity("a"), contentTypeEntity("b"), contentTypeEntity("c")]);
      const finding = checkContentTypes(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.code).to.equal("MAX_CONTENT_TYPES_EXCEEDED");
      expect(finding?.localValue).to.equal(3);
      expect(finding?.planValue).to.equal(2);
    });

    it("emits a low info when under limit", () => {
      const plan = planWith(feature(PLAN_KEYS.content_types, 100));
      const schema = schemaOf([contentTypeEntity("a"), contentTypeEntity("b")]);
      const finding = checkContentTypes(plan, schema);
      expect(finding?.level).to.equal("low");
      expect(finding?.code).to.equal("CONTENT_TYPES_OK");
    });

    it("emits capabilities-only finding with no local schema", () => {
      const plan = planWith(feature(PLAN_KEYS.content_types, 25));
      const finding = checkContentTypes(plan, undefined);
      expect(finding?.level).to.equal("low");
      expect(finding?.planValue).to.equal(25);
    });
  });

  describe("checkGlobalFields", () => {
    it("blocks when local count exceeds limit", () => {
      const plan = planWith(feature(PLAN_KEYS.global_fields, 1));
      const schema = schemaOf([globalFieldEntity("a"), globalFieldEntity("b")]);
      const finding = checkGlobalFields(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(2);
    });
  });

  describe("checkMaxFieldsPerContentType", () => {
    it("blocks when the largest CT exceeds the limit", () => {
      const plan = planWith(feature(PLAN_KEYS.max_fields_per_content_type, 2));
      const schema = schemaOf([
        contentTypeEntity("blog", [makeField("a", "text"), makeField("b", "text"), makeField("c", "text")]),
      ]);
      const finding = checkMaxFieldsPerContentType(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(3);
      expect(finding?.message).to.contain("blog");
    });
  });

  describe("checkMaxContentTypesPerReferenceField", () => {
    it("blocks when reference.to[] exceeds the limit", () => {
      const plan = planWith(feature(PLAN_KEYS.max_content_types_per_reference_field, 2));
      const schema = schemaOf([
        contentTypeEntity("blog", [
          makeField("related", "reference", { referenceTo: ["a", "b", "c"] }),
        ]),
      ]);
      const finding = checkMaxContentTypesPerReferenceField(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(3);
    });

    it("pass-through when under limit", () => {
      const plan = planWith(feature(PLAN_KEYS.max_content_types_per_reference_field, 5));
      const schema = schemaOf([
        contentTypeEntity("blog", [makeField("related", "reference", { referenceTo: ["a", "b"] })]),
      ]);
      const finding = checkMaxContentTypesPerReferenceField(plan, schema);
      expect(finding?.level).to.equal("low");
    });
  });

  describe("checkMaxModularBlocksPerContentType", () => {
    it("blocks when a CT has too many modular_blocks fields", () => {
      const plan = planWith(feature(PLAN_KEYS.max_modular_blocks_per_content_type, 1));
      const schema = schemaOf([
        contentTypeEntity("page", [
          makeField("blocks1", "modular_blocks", { blocks: [{ uid: "b1", title: "B1", fields: [] }] }),
          makeField("blocks2", "modular_blocks", { blocks: [{ uid: "b2", title: "B2", fields: [] }] }),
        ]),
      ]);
      const finding = checkMaxModularBlocksPerContentType(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(2);
    });
  });

  describe("checkMaxBlocksPerModularBlocksField", () => {
    it("counts blocks[] per modular_blocks field", () => {
      const plan = planWith(feature(PLAN_KEYS.max_blocks_per_modular_blocks_field, 1));
      const schema = schemaOf([
        contentTypeEntity("page", [
          makeField("blocks", "modular_blocks", {
            blocks: [
              { uid: "b1", title: "B1", fields: [] },
              { uid: "b2", title: "B2", fields: [] },
              { uid: "b3", title: "B3", fields: [] },
            ],
          }),
        ]),
      ]);
      const finding = checkMaxBlocksPerModularBlocksField(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(3);
    });
  });

  describe("checkMaxModularBlocksNestingDepth", () => {
    it("measures modular blocks nested inside modular blocks", () => {
      const plan = planWith(feature(PLAN_KEYS.max_modular_blocks_nesting_depth, 1));
      const schema = schemaOf([
        contentTypeEntity("page", [
          makeField("outer", "modular_blocks", {
            blocks: [
              {
                uid: "b1",
                title: "B1",
                fields: [
                  makeField("inner", "modular_blocks", {
                    blocks: [{ uid: "b2", title: "B2", fields: [] }],
                  }),
                ],
              },
            ],
          }),
        ]),
      ]);
      const finding = checkMaxModularBlocksNestingDepth(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(2);
    });

    it("flat modular blocks are depth 1", () => {
      const plan = planWith(feature(PLAN_KEYS.max_modular_blocks_nesting_depth, 6));
      const schema = schemaOf([
        contentTypeEntity("page", [
          makeField("blocks", "modular_blocks", {
            blocks: [{ uid: "b1", title: "B1", fields: [makeField("title", "text")] }],
          }),
        ]),
      ]);
      const finding = checkMaxModularBlocksNestingDepth(plan, schema);
      expect(finding?.level).to.equal("low");
      expect(finding?.localValue).to.equal(1);
    });
  });

  describe("checkMaxTaxonomiesPerContentType", () => {
    it("blocks when a CT has too many taxonomy fields", () => {
      const plan = planWith(feature(PLAN_KEYS.max_taxonomies_per_content_type, 1));
      const schema = schemaOf([
        contentTypeEntity("blog", [
          makeField("tags", "taxonomy"),
          makeField("categories", "taxonomy"),
        ]),
      ]);
      const finding = checkMaxTaxonomiesPerContentType(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(2);
    });
  });

  describe("checkMaxContentTypesPerJsonRte", () => {
    it("blocks when a json_rte's referenceTo[] exceeds limit", () => {
      const plan = planWith(feature(PLAN_KEYS.max_content_types_per_json_rte, 1));
      const schema = schemaOf([
        contentTypeEntity("blog", [
          makeField("body", "json_rte", { referenceTo: ["a", "b", "c"] }),
        ]),
      ]);
      const finding = checkMaxContentTypesPerJsonRte(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.localValue).to.equal(3);
    });
  });

  describe("checkTaxonomyAvailability", () => {
    it("blocks when DSL uses taxonomy but plan taxonomy is disabled", () => {
      const plan = planWith(feature(PLAN_KEYS.taxonomy, 0, false));
      const schema = schemaOf([contentTypeEntity("blog", [makeField("tags", "taxonomy")])]);
      const finding = checkTaxonomyAvailability(plan, schema);
      expect(finding?.level).to.equal("blocker");
      expect(finding?.code).to.equal("TAXONOMY_NOT_AVAILABLE");
    });

    it("silent pass when plan includes taxonomy and DSL uses it", () => {
      const plan = planWith(feature(PLAN_KEYS.taxonomy, 20));
      const schema = schemaOf([contentTypeEntity("blog", [makeField("tags", "taxonomy")])]);
      expect(checkTaxonomyAvailability(plan, schema)).to.equal(undefined);
    });

    it("informational when capabilities-only", () => {
      const plan = planWith(feature(PLAN_KEYS.taxonomy, 20));
      const finding = checkTaxonomyAvailability(plan, undefined);
      expect(finding?.level).to.equal("low");
      expect(finding?.code).to.equal("TAXONOMY_AVAILABLE");
    });
  });

  describe("checkBranches", () => {
    it("is purely informational (DSL doesn't declare branches)", () => {
      const plan = planWith(feature(PLAN_KEYS.branches, 5));
      const schema = schemaOf([contentTypeEntity("blog")]);
      const finding = checkBranches(plan, schema);
      expect(finding?.level).to.equal("low");
      expect(finding?.planValue).to.equal(5);
    });
  });
});
