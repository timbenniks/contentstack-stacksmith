import { describe, expect, it } from "vitest";

import type { CompiledEntity } from "@timbenniks/contentstack-stacksmith-core";

import {
  compileDefinitions,
  defineContentType,
  defineGlobalField,
  defineModels,
  enumField,
  file,
  globalField,
  jsonRte,
  link,
  markdown,
  reference,
  richText,
  taxonomy,
  text,
} from "../src/index.js";

describe("dsl", () => {
  it("compiles content types and global fields into normalized schema", () => {
    const author = defineContentType("author", {
      title: "Author",
      fields: [text("name", { required: true })],
    });

    const seo = defineGlobalField("seo", {
      title: "SEO",
      fields: [text("meta_title")],
    });

    const blogPost = defineContentType("blog_post", {
      title: "Blog Post",
      fields: [
        text("title", { required: true }),
        reference("author", { to: ["author"] }),
        globalField("seo", { ref: "seo" }),
        enumField("status", { choices: ["draft", "published"] }),
      ],
    });

    const schema = compileDefinitions([blogPost, seo, author]);

    expect(schema.entities.map((entity: CompiledEntity) => entity.uid).sort()).toEqual(["author", "blog_post", "seo"]);
    const blogPostEntity = schema.entities.find((e: CompiledEntity) => e.uid === "blog_post")!;
    expect(blogPostEntity.dependencies).toHaveLength(2);
  });

  it("rejects forward references to undefined global fields at compile time", () => {
    const blogPost = defineContentType("blog_post", {
      title: "Blog Post",
      fields: [
        text("title", { required: true }),
        globalField("seo", { ref: "seo_meta" }),
      ],
    });

    expect(() => compileDefinitions([blogPost])).toThrow(/missing global field "seo_meta"/);
  });

  it("rejects forward references to undefined content types at compile time", () => {
    const blogPost = defineContentType("blog_post", {
      title: "Blog Post",
      fields: [
        text("title", { required: true }),
        reference("author", { to: ["author"] }),
      ],
    });

    expect(() => compileDefinitions([blogPost])).toThrow(/missing content type "author"/);
  });

  it("supports registry composition", () => {
    const registry = defineModels({
      contentTypes: [
        defineContentType("author", {
          title: "Author",
          fields: [text("name", { required: true })],
        }),
      ],
    });

    const schema = compileDefinitions(registry.contentTypes ?? []);

    expect(schema.entities[0]?.uid).toBe("author");
  });

  it("auto-injects a required title field for content types when missing", () => {
    const ct = defineContentType("widget", {
      title: "Widget",
      fields: [text("description")],
    });

    const schema = compileDefinitions([ct]);
    const entity = schema.entities[0]!;
    const titleField = entity.fields.find((f) => f.uid === "title");

    expect(titleField).toBeDefined();
    expect(titleField!.required).toBe(true);
    expect(titleField!.kind).toBe("text");
    expect(entity.fields[0]?.uid).toBe("title");
  });

  it("ensures user-defined title field is required even if not marked", () => {
    const ct = defineContentType("widget", {
      title: "Widget",
      fields: [text("title"), text("description")],
    });

    const schema = compileDefinitions([ct]);
    const entity = schema.entities[0]!;
    const titleField = entity.fields.find((f) => f.uid === "title");

    expect(titleField).toBeDefined();
    expect(titleField!.required).toBe(true);
  });

  it("does NOT inject title field for global fields", () => {
    const gf = defineGlobalField("seo", {
      title: "SEO",
      fields: [text("meta_title")],
    });

    const schema = compileDefinitions([gf]);
    const entity = schema.entities[0]!;

    expect(entity.fields.some((f) => f.uid === "title")).toBe(false);
  });

  it("compiles file field", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [file("hero_image")],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "hero_image");
    expect(field?.kind).toBe("file");
  });

  it("compiles link field", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [link("external_url")],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "external_url");
    expect(field?.kind).toBe("link");
  });

  it("compiles markdown field", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [markdown("body")],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "body");
    expect(field?.kind).toBe("markdown");
  });

  it("compiles rich text field with richTextType", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [richText("content", { richTextType: "basic" })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "content");
    expect(field?.kind).toBe("rich_text");
    expect(field?.richTextType).toBe("basic");
  });

  it("compiles JSON RTE field with referenceTo", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [jsonRte("body", { referenceTo: ["blog_post"] })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "body");
    expect(field?.kind).toBe("json_rte");
    expect(field?.richTextType).toBe("advanced");
    expect(field?.referenceTo).toEqual(["blog_post"]);
  });

  it("compiles taxonomy field with taxonomy refs", () => {
    const ct = defineContentType("product", {
      title: "Product",
      fields: [taxonomy("categories", { taxonomies: [{ taxonomy_uid: "product_categories", max_terms: 5 }] })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "categories");
    expect(field?.kind).toBe("taxonomy");
    expect(field?.taxonomies).toEqual([{ taxonomy_uid: "product_categories", max_terms: 5 }]);
  });
});
