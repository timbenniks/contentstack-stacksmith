import { describe, expect, it } from "vitest";

import { normalizeSchema } from "@timbenniks/contentstack-stacksmith-core";

import { validateSchema } from "../src/index.js";

describe("validateSchema recursive nested fields", () => {
  it("detects duplicate field uid inside a group", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            {
              uid: "details",
              displayName: "Details",
              kind: "group",
              metadata: {},
              fields: [
                { uid: "name", displayName: "Name", kind: "text", metadata: {} },
                { uid: "name", displayName: "Name 2", kind: "text", metadata: {} },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "DUPLICATE_UID" && f.message.includes("name"))).toBe(true);
  });

  it("allows same field uid at different nesting levels (Contentstack permits this)", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            { uid: "title", displayName: "Title", kind: "text", metadata: {} },
            {
              uid: "details",
              displayName: "Details",
              kind: "group",
              metadata: {},
              fields: [
                { uid: "title", displayName: "Nested Title", kind: "text", metadata: {} },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.filter((f) => f.code === "DUPLICATE_UID")).toHaveLength(0);
  });

  it("detects missing reference target inside a group", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            {
              uid: "details",
              displayName: "Details",
              kind: "group",
              metadata: {},
              fields: [
                {
                  uid: "author",
                  displayName: "Author",
                  kind: "reference",
                  referenceTo: ["nonexistent"],
                  metadata: {},
                },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "MISSING_REFERENCE_TARGET")).toBe(true);
  });

  it("detects missing global field ref inside a modular block", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            {
              uid: "content",
              displayName: "Content",
              kind: "modular_blocks",
              metadata: {},
              blocks: [
                {
                  uid: "hero",
                  title: "Hero",
                  fields: [
                    {
                      uid: "seo",
                      displayName: "SEO",
                      kind: "global_field",
                      globalFieldRef: "nonexistent_gf",
                      metadata: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "MISSING_GLOBAL_FIELD")).toBe(true);
  });

  it("detects empty modular_blocks nested inside a group", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            {
              uid: "details",
              displayName: "Details",
              kind: "group",
              metadata: {},
              fields: [
                {
                  uid: "blocks",
                  displayName: "Blocks",
                  kind: "modular_blocks",
                  metadata: {},
                },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "EMPTY_MODULAR_BLOCKS")).toBe(true);
  });

  it("produces zero findings for valid schema with nested fields", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "author",
          title: "Author",
          metadata: {},
          fields: [
            { uid: "title", displayName: "Title", kind: "text", required: true, metadata: {} },
            { uid: "name", displayName: "Name", kind: "text", metadata: {} },
          ],
        },
        {
          kind: "content_type",
          uid: "page",
          title: "Page",
          metadata: {},
          fields: [
            { uid: "title", displayName: "Title", kind: "text", required: true, metadata: {} },
            {
              uid: "details",
              displayName: "Details",
              kind: "group",
              metadata: {},
              fields: [
                { uid: "subtitle", displayName: "Subtitle", kind: "text", metadata: {} },
                {
                  uid: "related",
                  displayName: "Related",
                  kind: "reference",
                  referenceTo: ["author"],
                  metadata: {},
                },
              ],
            },
          ],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings).toHaveLength(0);
  });

  it("flags content type missing title field", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "widget",
          title: "Widget",
          metadata: {},
          fields: [{ uid: "name", displayName: "Name", kind: "text", metadata: {} }],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "MISSING_TITLE_FIELD")).toBe(true);
  });

  it("flags content type with non-required title field", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "widget",
          title: "Widget",
          metadata: {},
          fields: [{ uid: "title", displayName: "Title", kind: "text", required: false, metadata: {} }],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.some((f) => f.code === "TITLE_FIELD_NOT_REQUIRED")).toBe(true);
  });

  it("does NOT flag global fields for missing title field", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "global_field",
          uid: "seo",
          title: "SEO",
          metadata: {},
          fields: [{ uid: "meta_title", displayName: "Meta Title", kind: "text", metadata: {} }],
        },
      ],
    });

    const findings = validateSchema(schema);
    expect(findings.filter((f) => f.code === "MISSING_TITLE_FIELD")).toHaveLength(0);
  });
});
