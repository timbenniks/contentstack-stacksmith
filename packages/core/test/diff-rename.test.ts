import { describe, expect, it } from "vitest";

import { diffSchemas, normalizeSchema, type SchemaArtifact } from "../src/index.js";

const buildSchema = (fieldUid: string, previousUid?: string): SchemaArtifact =>
  normalizeSchema({
    entities: [
      {
        kind: "content_type",
        uid: "blog_post",
        title: "Blog Post",
        metadata: {},
        fields: [
          {
            uid: "title",
            displayName: "Title",
            kind: "text",
            required: true,
            unique: false,
            multiple: false,
            metadata: {},
          },
          {
            uid: fieldUid,
            ...(previousUid ? { previousUid } : {}),
            displayName: "Author Name",
            kind: "text",
            required: false,
            unique: false,
            multiple: false,
            metadata: {},
          },
        ],
      },
    ],
    metadata: {},
  });

describe("diff rename detection", () => {
  it("emits a single rename_field op when a field declares previousUid", () => {
    const local = buildSchema("author_full_name", "author_name");
    const remote = buildSchema("author_name");

    const diff = diffSchemas(local, remote);

    const renameOps = diff.operations.filter((op) => op.kind === "rename_field");
    const removeOps = diff.operations.filter((op) => op.kind === "remove_field");
    const addOps = diff.operations.filter((op) => op.kind === "add_field");

    expect(renameOps).toHaveLength(1);
    expect(removeOps).toHaveLength(0);
    expect(addOps).toHaveLength(0);
    expect(renameOps[0]!.fieldUid).toBe("author_full_name");
    expect(renameOps[0]!.summary).toContain("author_name");
    expect(renameOps[0]!.summary).toContain("author_full_name");
  });

  it("falls back to add_field when previousUid points to a non-existent remote field", () => {
    // Fresh stack, no remote field exists yet. previousUid is vestigial.
    const local = buildSchema("author_full_name", "author_name");
    const remote = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "blog_post",
          title: "Blog Post",
          metadata: {},
          fields: [
            {
              uid: "title",
              displayName: "Title",
              kind: "text",
              required: true,
              unique: false,
              multiple: false,
              metadata: {},
            },
          ],
        },
      ],
      metadata: {},
    });

    const diff = diffSchemas(local, remote);

    expect(diff.operations.filter((op) => op.kind === "rename_field")).toHaveLength(0);
    expect(diff.operations.filter((op) => op.kind === "add_field")).toHaveLength(1);
  });

  it("emits a collision rename_field op when both old and new uids exist on the remote", () => {
    const local = buildSchema("author_full_name", "author_name");
    const remote = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "blog_post",
          title: "Blog Post",
          metadata: {},
          fields: [
            {
              uid: "title",
              displayName: "Title",
              kind: "text",
              required: true,
              unique: false,
              multiple: false,
              metadata: {},
            },
            {
              uid: "author_name",
              displayName: "Author Name",
              kind: "text",
              required: false,
              unique: false,
              multiple: false,
              metadata: {},
            },
            {
              uid: "author_full_name",
              displayName: "Author Full Name",
              kind: "text",
              required: false,
              unique: false,
              multiple: false,
              metadata: {},
            },
          ],
        },
      ],
      metadata: {},
    });

    const diff = diffSchemas(local, remote);

    const renameOps = diff.operations.filter((op) => op.kind === "rename_field");
    expect(renameOps).toHaveLength(1);
    expect(renameOps[0]!.details[0]!.message).toMatch(/Cannot rename/);
    // The remote's old uid must not be separately scheduled for removal.
    expect(diff.operations.filter((op) => op.kind === "remove_field")).toHaveLength(0);
  });
});
