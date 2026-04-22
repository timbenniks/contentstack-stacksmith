import { describe, expect, it } from "vitest";

import {
  boolean,
  compileDefinitions,
  compileModelRegistry,
  date,
  defineContentType,
  defineGlobalField,
  defineModels,
  defineModelsConfig,
  enumField,
  file,
  group,
  json,
  link,
  markdown,
  modularBlocks,
  number,
  reference,
  text,
} from "../src/index.js";

describe("field builders (properties)", () => {
  it("text() respects required, unique, multiple, defaultValue, metadata", () => {
    const field = text("name", { required: true, unique: true, multiple: true, defaultValue: "hello", metadata: { custom: true } });
    expect(field.required).toBe(true);
    expect(field.unique).toBe(true);
    expect(field.multiple).toBe(true);
    expect(field.defaultValue).toBe("hello");
    expect(field.metadata?.custom).toBe(true);
  });

  it("number() defaults multiple to false", () => {
    const field = number("count");
    expect(field.multiple).toBe(false);
  });

  it("boolean() defaults multiple to false", () => {
    const field = boolean("active");
    expect(field.multiple).toBe(false);
  });

  it("date() defaults multiple to false", () => {
    const field = date("published_at");
    expect(field.multiple).toBe(false);
  });

  it("json() defaults multiple to false", () => {
    const field = json("data");
    expect(field.multiple).toBe(false);
  });

  it("modularBlocks() defaults multiple to true", () => {
    const field = modularBlocks("sections", { blocks: [{ uid: "hero", title: "Hero", fields: [text("heading")] }] });
    expect(field.multiple).toBe(true);
  });

  it("group() produces correct structure with nested fields", () => {
    const field = group("details", { fields: [text("name"), number("age")] });
    expect(field.kind).toBe("group");
    expect(field.fields).toHaveLength(2);
  });

  it("all builders auto-generate title from uid", () => {
    expect(text("meta_title").title).toBe("Meta Title");
    expect(number("item_count").title).toBe("Item Count");
    expect(boolean("is_active").title).toBe("Is Active");
    expect(date("created_at").title).toBe("Created At");
    expect(file("hero_image").title).toBe("Hero Image");
    expect(link("external_url").title).toBe("External Url");
    expect(markdown("body_text").title).toBe("Body Text");
  });

  it("all builders accept custom title", () => {
    expect(text("slug", { title: "Custom" }).title).toBe("Custom");
    expect(number("x", { title: "Custom" }).title).toBe("Custom");
  });
});

describe("entity definitions", () => {
  it("defineContentType sets entityType to content_type", () => {
    const ct = defineContentType("page", { title: "Page", fields: [text("title")] });
    expect(ct.entityType).toBe("content_type");
    expect(ct.uid).toBe("page");
  });

  it("defineGlobalField sets entityType to global_field", () => {
    const gf = defineGlobalField("seo", { title: "SEO", fields: [text("meta")] });
    expect(gf.entityType).toBe("global_field");
    expect(gf.uid).toBe("seo");
  });

  it("defineModels returns a typed registry", () => {
    const registry = defineModels({ contentTypes: [defineContentType("page", { title: "Page", fields: [] })] });
    expect(registry.contentTypes).toHaveLength(1);
  });

  it("defineModelsConfig provides correct defaults", () => {
    const config = defineModelsConfig({ projectName: "test" });
    expect(config.modelsEntry).toBe("./src/models/index.ts");
    expect(config.outDir).toBe("./.contentstack/models");
    expect(config.strict).toBe(true);
  });
});

describe("compilation", () => {
  it("compileModelRegistry produces a valid normalized schema", () => {
    const registry = defineModels({
      contentTypes: [defineContentType("page", { title: "Page", fields: [text("body")] })],
      globalFields: [defineGlobalField("seo", { title: "SEO", fields: [text("meta")] })],
    });
    const schema = compileModelRegistry(registry);
    expect(schema.entities).toHaveLength(2);
    expect(schema.schemaVersion).toBe(1);
  });

  it("assertDefinitions catches duplicate entity UIDs", () => {
    const ct1 = defineContentType("page", { title: "Page", fields: [text("title")] });
    const ct2 = defineContentType("page", { title: "Page 2", fields: [text("title")] });
    expect(() => compileDefinitions([ct1, ct2])).toThrow("Duplicate definition");
  });

  it("compilation preserves field order", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [text("title", { required: true }), text("slug"), text("body")],
    });
    const schema = compileDefinitions([ct]);
    const fields = schema.entities[0]!.fields;
    expect(fields[0]?.uid).toBe("title");
    expect(fields[1]?.uid).toBe("slug");
    expect(fields[2]?.uid).toBe("body");
  });
});

describe("error cases", () => {
  it("field without uid throws", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [{ kind: "text" as const, uid: "", title: "Bad" }] as any,
    });
    expect(() => compileDefinitions([ct])).toThrow();
  });

  it("invalid UID format throws in builders", () => {
    expect(() => text("Invalid UID!")).toThrow("Invalid UID");
    expect(() => text("123start")).toThrow("Invalid UID");
    expect(() => text("UPPERCASE")).toThrow("Invalid UID");
  });

  it("invalid UID format throws in entity definitions", () => {
    expect(() => defineContentType("Bad-Name", { title: "Bad", fields: [] })).toThrow("Invalid UID");
  });

  it("empty to array in reference throws", () => {
    expect(() => reference("author", { to: [] })).toThrow("at least one target");
  });

  it("empty choices in enumField throws", () => {
    expect(() => enumField("status", { choices: [] })).toThrow("at least one choice");
  });
});

describe("constraint options", () => {
  it("text() passes multiline and format through compilation", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [text("bio", { multiline: true, format: "^[a-z]+$", formatErrorMessage: "Letters only" })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "bio");
    expect(field?.multiline).toBe(true);
    expect(field?.format).toBe("^[a-z]+$");
    expect(field?.errorMessages).toEqual({ format: "Letters only" });
  });

  it("date() passes startDate and endDate through compilation", () => {
    const ct = defineContentType("event", {
      title: "Event",
      fields: [date("event_date", { startDate: "2024-01-01", endDate: "2025-12-31" })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "event_date");
    expect(field?.startDate).toBe("2024-01-01");
    expect(field?.endDate).toBe("2025-12-31");
  });

  it("enumField() passes displayType through compilation", () => {
    const ct = defineContentType("page", {
      title: "Page",
      fields: [enumField("status", { choices: ["draft", "published"], displayType: "radio" })],
    });
    const schema = compileDefinitions([ct]);
    const field = schema.entities[0]!.fields.find((f) => f.uid === "status");
    expect(field?.displayType).toBe("radio");
  });
});
