import { describe, expect, it } from "vitest";

import { createPlan, diffSchemas, normalizeSchema } from "@timbenniks/contentstack-stacksmith-core";

import { analyzePlanRisk, validateDiff, validateSchema } from "../src/index.js";

describe("validators", () => {
  it("finds missing references in schema", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "article",
          title: "Article",
          metadata: {},
          fields: [
            {
              uid: "author",
              displayName: "Author",
              kind: "reference",
              required: false,
              unique: false,
              multiple: false,
              referenceTo: ["author"],
              metadata: {},
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings[0]?.code).toBe("MISSING_REFERENCE_TARGET");
  });

  it("blocks destructive diff changes", () => {
    const local = normalizeSchema({ entities: [], metadata: {} });
    const remote = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "article",
          title: "Article",
          metadata: {},
          fields: [],
        },
      ],
    });

    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    const plan = createPlan(diff, undefined, findings);

    expect(findings[0]?.code).toBe("DESTRUCTIVE_CHANGE");
    expect(analyzePlanRisk(plan)[0]?.code).toBe("PLAN_BLOCKED");
  });

  it("flags unique tightening as breaking", () => {
    const local = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: true, multiple: false, metadata: {} },
      ] }],
    });
    const remote = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
      ] }],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("flags multiple reduction as breaking", () => {
    const local = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        { uid: "tags", displayName: "Tags", kind: "text", required: false, unique: false, multiple: false, metadata: {} },
      ] }],
    });
    const remote = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        { uid: "tags", displayName: "Tags", kind: "text", required: false, unique: false, multiple: true, metadata: {} },
      ] }],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("flags enum choices narrowing as breaking", () => {
    const local = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        { uid: "status", displayName: "Status", kind: "enum", required: false, unique: false, multiple: false, enumChoices: ["draft", "published"], metadata: {} },
      ] }],
    });
    const remote = normalizeSchema({
      entities: [{ kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
        { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        { uid: "status", displayName: "Status", kind: "enum", required: false, unique: false, multiple: false, enumChoices: ["draft", "published", "archived"], metadata: {} },
      ] }],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("flags globalFieldRef change as breaking", () => {
    const local = normalizeSchema({
      entities: [
        { kind: "global_field", uid: "seo_v2", title: "SEO V2", metadata: {}, fields: [
          { uid: "meta", displayName: "Meta", kind: "text", required: false, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "seo", displayName: "SEO", kind: "global_field", required: false, unique: false, multiple: false, globalFieldRef: "seo_v2", metadata: {} },
        ] },
      ],
    });
    const remote = normalizeSchema({
      entities: [
        { kind: "global_field", uid: "seo_v1", title: "SEO V1", metadata: {}, fields: [
          { uid: "meta", displayName: "Meta", kind: "text", required: false, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "seo", displayName: "SEO", kind: "global_field", required: false, unique: false, multiple: false, globalFieldRef: "seo_v1", metadata: {} },
        ] },
      ],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("flags referenceTo narrowing as breaking", () => {
    const local = normalizeSchema({
      entities: [
        { kind: "content_type", uid: "author", title: "Author", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "ref", displayName: "Ref", kind: "reference", required: false, unique: false, multiple: false, referenceTo: ["author"], metadata: {} },
        ] },
      ],
    });
    const remote = normalizeSchema({
      entities: [
        { kind: "content_type", uid: "author", title: "Author", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "page", title: "Page", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "ref", displayName: "Ref", kind: "reference", required: false, unique: false, multiple: false, referenceTo: ["author", "page"], metadata: {} },
        ] },
      ],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(true);
  });

  it("does NOT flag referenceTo expansion as breaking", () => {
    const local = normalizeSchema({
      entities: [
        { kind: "content_type", uid: "author", title: "Author", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "page", title: "Page", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "ref", displayName: "Ref", kind: "reference", required: false, unique: false, multiple: false, referenceTo: ["author", "page"], metadata: {} },
        ] },
      ],
    });
    const remote = normalizeSchema({
      entities: [
        { kind: "content_type", uid: "author", title: "Author", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
        ] },
        { kind: "content_type", uid: "ct", title: "CT", metadata: {}, fields: [
          { uid: "title", displayName: "Title", kind: "text", required: true, unique: false, multiple: false, metadata: {} },
          { uid: "ref", displayName: "Ref", kind: "reference", required: false, unique: false, multiple: false, referenceTo: ["author"], metadata: {} },
        ] },
      ],
    });
    const diff = diffSchemas(local, remote);
    const findings = validateDiff(diff);
    expect(findings.some((f) => f.code === "BREAKING_FIELD_MUTATION")).toBe(false);
  });
});
