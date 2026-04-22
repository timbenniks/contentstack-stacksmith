import { describe, expect, it } from "vitest";

import { normalizeSchema, ValidationError } from "../src/index.js";

describe("normalizeSchema input validation", () => {
  it("throws ValidationError for entity with empty uid", () => {
    expect(() =>
      normalizeSchema({
        entities: [{ kind: "content_type", uid: "", title: "Empty", metadata: {}, fields: [] }],
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for entity with whitespace-only uid", () => {
    expect(() =>
      normalizeSchema({
        entities: [{ kind: "content_type", uid: "   ", title: "Spaces", metadata: {}, fields: [] }],
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for entity with invalid kind", () => {
    expect(() =>
      normalizeSchema({
        entities: [{ kind: "page" as any, uid: "test", title: "Test", metadata: {}, fields: [] }],
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for duplicate uid within same kind", () => {
    expect(() =>
      normalizeSchema({
        entities: [
          { kind: "content_type", uid: "article", title: "Article", metadata: {}, fields: [] },
          { kind: "content_type", uid: "article", title: "Article 2", metadata: {}, fields: [] },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("does NOT throw for duplicate uid across different kinds", () => {
    expect(() =>
      normalizeSchema({
        entities: [
          { kind: "content_type", uid: "seo", title: "SEO CT", metadata: {}, fields: [] },
          { kind: "global_field", uid: "seo", title: "SEO GF", metadata: {}, fields: [] },
        ],
      }),
    ).not.toThrow();
  });

  it("throws ValidationError for field with empty uid", () => {
    expect(() =>
      normalizeSchema({
        entities: [
          {
            kind: "content_type",
            uid: "article",
            title: "Article",
            metadata: {},
            fields: [{ uid: "", displayName: "Empty", kind: "text", metadata: {} }],
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for duplicate field uid in entity", () => {
    expect(() =>
      normalizeSchema({
        entities: [
          {
            kind: "content_type",
            uid: "article",
            title: "Article",
            metadata: {},
            fields: [
              { uid: "title", displayName: "Title", kind: "text", metadata: {} },
              { uid: "title", displayName: "Title 2", kind: "text", metadata: {} },
            ],
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("does NOT throw for valid schema input", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "article",
          title: "Article",
          metadata: {},
          fields: [
            { uid: "title", displayName: "Title", kind: "text", metadata: {} },
            { uid: "body", displayName: "Body", kind: "text", metadata: {} },
          ],
        },
      ],
    });

    expect(schema.entities).toHaveLength(1);
    expect(schema.entities[0]?.uid).toBe("article");
  });
});
