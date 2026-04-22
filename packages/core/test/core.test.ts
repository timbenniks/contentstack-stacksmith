import { describe, expect, it } from "vitest";

import { buildDependencyGraph, createPlan, diffSchemas, normalizeSchema } from "../src/index.js";

describe("core", () => {
  it("normalizes entities deterministically", () => {
    const schema = normalizeSchema({
      entities: [
        {
          kind: "content_type",
          uid: "blog_post",
          title: "Blog Post",
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
        {
          kind: "content_type",
          uid: "author",
          title: "Author",
          metadata: {},
          fields: [
            {
              uid: "name",
              displayName: "Name",
              kind: "text",
              required: true,
              unique: false,
              multiple: false,
              metadata: {},
            },
          ],
        },
      ],
    });

    expect(schema.entities[0]?.uid).toBe("author");
    expect(schema.entities[1]?.dependencies[0]?.targetEntityId).toBe("content_type:author");
    expect(schema.entities[1]?.fields[0]?.order).toBe(0);
  });

  it("builds dependency order and plan output", () => {
    const local = normalizeSchema({
      entities: [
        {
          kind: "global_field",
          uid: "seo",
          title: "SEO",
          metadata: {},
          fields: [
            {
              uid: "meta_title",
              displayName: "Meta Title",
              kind: "text",
              required: false,
              unique: false,
              multiple: false,
              metadata: {},
            },
          ],
        },
        {
          kind: "content_type",
          uid: "blog_post",
          title: "Blog Post",
          metadata: {},
          fields: [
            {
              uid: "seo",
              displayName: "SEO",
              kind: "global_field",
              required: false,
              unique: false,
              multiple: false,
              globalFieldRef: "seo",
              metadata: {},
            },
          ],
        },
      ],
    });

    const graph = buildDependencyGraph(local);
    const plan = createPlan(diffSchemas(local), graph);

    expect(graph.order).toEqual(["global_field:seo", "content_type:blog_post"]);
    expect(plan.dependencyNotes[0]).toContain("blog_post depends on global field seo");
  });
});
