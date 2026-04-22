import { describe, expect, it } from "vitest";

import { diffSchemas, normalizeSchema } from "../src/index.js";

const makeSchema = (fields: any[]) =>
  normalizeSchema({
    entities: [
      {
        kind: "content_type",
        uid: "page",
        title: "Page",
        metadata: {},
        fields,
      },
    ],
  });

describe("diffSchemas nested field detection", () => {
  it("detects added sub-field in a group", () => {
    const remote = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [{ uid: "name", displayName: "Name", kind: "text", metadata: {} }],
      },
    ]);

    const local = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [
          { uid: "name", displayName: "Name", kind: "text", metadata: {} },
          { uid: "bio", displayName: "Bio", kind: "text", metadata: {} },
        ],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field" && op.fieldUid === "details");

    expect(updateOps).toHaveLength(1);
    expect(updateOps[0]?.details.some((d) => d.path.includes(".fields"))).toBe(true);
  });

  it("detects removed sub-field from a group", () => {
    const remote = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [
          { uid: "name", displayName: "Name", kind: "text", metadata: {} },
          { uid: "bio", displayName: "Bio", kind: "text", metadata: {} },
        ],
      },
    ]);

    const local = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [{ uid: "name", displayName: "Name", kind: "text", metadata: {} }],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field" && op.fieldUid === "details");

    expect(updateOps).toHaveLength(1);
  });

  it("detects changed property on a group sub-field", () => {
    const remote = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [{ uid: "name", displayName: "Name", kind: "text", required: false, metadata: {} }],
      },
    ]);

    const local = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [{ uid: "name", displayName: "Name", kind: "text", required: true, metadata: {} }],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field" && op.fieldUid === "details");

    expect(updateOps).toHaveLength(1);
    expect(updateOps[0]?.details.some((d) => d.path === "fields.details.fields")).toBe(true);
  });

  it("detects added block in modular_blocks", () => {
    const remote = makeSchema([
      {
        uid: "content",
        displayName: "Content",
        kind: "modular_blocks",
        metadata: {},
        blocks: [
          { uid: "hero", title: "Hero", fields: [{ uid: "heading", displayName: "Heading", kind: "text", metadata: {} }] },
        ],
      },
    ]);

    const local = makeSchema([
      {
        uid: "content",
        displayName: "Content",
        kind: "modular_blocks",
        metadata: {},
        blocks: [
          { uid: "hero", title: "Hero", fields: [{ uid: "heading", displayName: "Heading", kind: "text", metadata: {} }] },
          { uid: "cta", title: "CTA", fields: [{ uid: "label", displayName: "Label", kind: "text", metadata: {} }] },
        ],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field" && op.fieldUid === "content");

    expect(updateOps).toHaveLength(1);
    expect(updateOps[0]?.details.some((d) => d.path === "fields.content.blocks")).toBe(true);
  });

  it("detects changed sub-field within a modular block", () => {
    const remote = makeSchema([
      {
        uid: "content",
        displayName: "Content",
        kind: "modular_blocks",
        metadata: {},
        blocks: [
          { uid: "hero", title: "Hero", fields: [{ uid: "heading", displayName: "Heading", kind: "text", required: false, metadata: {} }] },
        ],
      },
    ]);

    const local = makeSchema([
      {
        uid: "content",
        displayName: "Content",
        kind: "modular_blocks",
        metadata: {},
        blocks: [
          { uid: "hero", title: "Hero", fields: [{ uid: "heading", displayName: "Heading", kind: "text", required: true, metadata: {} }] },
        ],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field" && op.fieldUid === "content");

    expect(updateOps).toHaveLength(1);
  });

  it("no false positive when nested fields are identical", () => {
    const schema = makeSchema([
      {
        uid: "details",
        displayName: "Details",
        kind: "group",
        metadata: {},
        fields: [{ uid: "name", displayName: "Name", kind: "text", metadata: {} }],
      },
    ]);

    const diff = diffSchemas(schema, schema);

    expect(diff.operations).toHaveLength(0);
  });

  it("detects deeply nested change (group in group)", () => {
    const remote = makeSchema([
      {
        uid: "outer",
        displayName: "Outer",
        kind: "group",
        metadata: {},
        fields: [
          {
            uid: "inner",
            displayName: "Inner",
            kind: "group",
            metadata: {},
            fields: [{ uid: "deep", displayName: "Deep", kind: "text", metadata: {} }],
          },
        ],
      },
    ]);

    const local = makeSchema([
      {
        uid: "outer",
        displayName: "Outer",
        kind: "group",
        metadata: {},
        fields: [
          {
            uid: "inner",
            displayName: "Inner",
            kind: "group",
            metadata: {},
            fields: [
              { uid: "deep", displayName: "Deep", kind: "text", metadata: {} },
              { uid: "deeper", displayName: "Deeper", kind: "number", metadata: {} },
            ],
          },
        ],
      },
    ]);

    const diff = diffSchemas(local, remote);
    const updateOps = diff.operations.filter((op) => op.kind === "update_field");

    expect(updateOps.length).toBeGreaterThanOrEqual(1);
    expect(updateOps.some((op) => op.fieldUid === "outer")).toBe(true);
  });
});
