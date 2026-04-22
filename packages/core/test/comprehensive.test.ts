import { describe, expect, it } from "vitest";

import type { FieldKind, NormalizableFieldInput } from "../src/index.js";
import {
  buildDependencyGraph,
  CoreError,
  createPlan,
  DependencyCycleError,
  diffSchemas,
  isPrimitiveFieldKind,
  normalizeSchema,
  toCanonicalJson,
  ValidationError,
} from "../src/index.js";

const simpleField = (uid: string, kind: FieldKind = "text", extra: Partial<NormalizableFieldInput> = {}): NormalizableFieldInput => ({
  uid,
  displayName: uid,
  kind,
  required: false,
  unique: false,
  multiple: false,
  metadata: {},
  ...extra,
});

const simpleEntity = (kind: "content_type" | "global_field", uid: string, fields = [simpleField("title")]) => ({
  kind,
  uid,
  title: uid,
  metadata: {},
  fields,
});

describe("normalize-schema (comprehensive)", () => {
  it("assigns deterministic entity IDs", () => {
    const schema = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    expect(schema.entities[0]?.id).toBe("content_type:page");
  });

  it("assigns field order by array index", () => {
    const schema = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("a"), simpleField("b"), simpleField("c")])],
    });
    expect(schema.entities[0]?.fields.map((f) => f.order)).toEqual([0, 1, 2]);
  });

  it("extracts reference dependencies", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("content_type", "author"),
        simpleEntity("content_type", "post", [
          simpleField("author", "reference", { referenceTo: ["author"] }),
        ]),
      ],
    });
    const post = schema.entities.find((e) => e.uid === "post");
    expect(post?.dependencies[0]?.targetEntityId).toBe("content_type:author");
    expect(post?.dependencies[0]?.reason).toBe("reference");
  });

  it("extracts global field dependencies", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("global_field", "seo"),
        simpleEntity("content_type", "page", [
          simpleField("seo", "global_field", { globalFieldRef: "seo" }),
        ]),
      ],
    });
    const page = schema.entities.find((e) => e.uid === "page");
    expect(page?.dependencies[0]?.targetEntityId).toBe("global_field:seo");
    expect(page?.dependencies[0]?.reason).toBe("global_field");
  });

  it("deduplicates dependencies", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("content_type", "author"),
        simpleEntity("content_type", "post", [
          simpleField("author1", "reference", { referenceTo: ["author"] }),
          simpleField("author2", "reference", { referenceTo: ["author"] }),
        ]),
      ],
    });
    const deps = schema.entities[1]?.dependencies.filter((d) => d.targetEntityId === "content_type:author");
    expect(deps).toHaveLength(2);
  });

  it("sorts entities deterministically (by kind alphabetically, then by uid)", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("content_type", "zebra"),
        simpleEntity("global_field", "meta"),
        simpleEntity("content_type", "alpha"),
      ],
    });
    // "content_type" < "global_field" alphabetically, then by uid within kind
    expect(schema.entities.map((e) => e.uid)).toEqual(["alpha", "zebra", "meta"]);
  });

  it("handles empty entity list", () => {
    const schema = normalizeSchema({ entities: [], metadata: {} });
    expect(schema.entities).toEqual([]);
  });

  it("handles entity with zero fields", () => {
    const schema = normalizeSchema({ entities: [simpleEntity("content_type", "empty", [])], metadata: {} });
    expect(schema.entities[0]?.fields).toEqual([]);
  });

  it("is idempotent (normalizing a normalized schema produces same result)", () => {
    const input = { entities: [simpleEntity("content_type", "page")], metadata: {} };
    const first = normalizeSchema(input);
    const second = normalizeSchema(first);
    expect(toCanonicalJson(first)).toBe(toCanonicalJson(second));
  });
});

describe("toCanonicalJson", () => {
  it("sorts object keys", () => {
    expect(toCanonicalJson({ b: 2, a: 1 })).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("handles null, arrays, nested objects, primitives", () => {
    expect(JSON.parse(toCanonicalJson(null))).toBe(null);
    expect(JSON.parse(toCanonicalJson([3, 1, 2]))).toEqual([3, 1, 2]);
    expect(JSON.parse(toCanonicalJson({ a: { c: 1, b: 2 } }))).toEqual({ a: { b: 2, c: 1 } });
    expect(JSON.parse(toCanonicalJson("hello"))).toBe("hello");
    expect(JSON.parse(toCanonicalJson(42))).toBe(42);
  });
});

describe("diff-schemas (comprehensive)", () => {
  it("detects new entities", () => {
    const local = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    const remote = normalizeSchema({ entities: [], metadata: {} });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "create_entity" && op.entity.uid === "page")).toBe(true);
  });

  it("detects deleted entities", () => {
    const local = normalizeSchema({ entities: [], metadata: {} });
    const remote = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "delete_entity" && op.entity.uid === "page")).toBe(true);
  });

  it("detects updated entity description", () => {
    const local = normalizeSchema({
      entities: [{ ...simpleEntity("content_type", "page"), description: "Updated" }],
    });
    const remote = normalizeSchema({
      entities: [{ ...simpleEntity("content_type", "page"), description: "Original" }],
    });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "update_entity")).toBe(true);
  });

  it("detects added fields", () => {
    const local = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("title"), simpleField("slug")])],
    });
    const remote = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("title")])],
    });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "add_field" && op.fieldUid === "slug")).toBe(true);
  });

  it("detects removed fields", () => {
    const local = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("title")])],
    });
    const remote = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("title"), simpleField("slug")])],
    });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "remove_field" && op.fieldUid === "slug")).toBe(true);
  });

  it("detects modified fields (required change)", () => {
    const local = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [{ ...simpleField("title"), required: true }])],
    });
    const remote = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [{ ...simpleField("title"), required: false }])],
    });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "update_field")).toBe(true);
  });

  it("detects reordered fields", () => {
    const local = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("a"), simpleField("b")])],
    });
    const remote = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("b"), simpleField("a")])],
    });
    const diff = diffSchemas(local, remote);
    expect(diff.operations.some((op) => op.kind === "reorder_fields")).toBe(true);
  });

  it("handles remote being undefined", () => {
    const local = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    const diff = diffSchemas(local);
    expect(diff.operations.length).toBeGreaterThan(0);
  });

  it("handles identical schemas (no operations)", () => {
    const schema = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    const diff = diffSchemas(schema, schema);
    expect(diff.operations).toHaveLength(0);
  });
});

describe("build-dependency-graph (comprehensive)", () => {
  it("topological order respects dependencies (A depends on B)", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("content_type", "author"),
        simpleEntity("content_type", "post", [
          simpleField("author", "reference", { referenceTo: ["author"] }),
        ]),
      ],
    });
    const graph = buildDependencyGraph(schema);
    const authorIdx = graph.order.indexOf("content_type:author");
    const postIdx = graph.order.indexOf("content_type:post");
    expect(authorIdx).toBeLessThan(postIdx);
  });

  it("handles entities with no dependencies", () => {
    const schema = normalizeSchema({
      entities: [simpleEntity("content_type", "a"), simpleEntity("content_type", "b")],
    });
    const graph = buildDependencyGraph(schema);
    expect(graph.order).toHaveLength(2);
    expect(graph.cycles).toHaveLength(0);
  });

  it("deterministic ordering for independent nodes (alphabetical)", () => {
    const schema = normalizeSchema({
      entities: [simpleEntity("content_type", "zebra"), simpleEntity("content_type", "alpha")],
    });
    const graph = buildDependencyGraph(schema);
    expect(graph.order[0]).toBe("content_type:alpha");
    expect(graph.order[1]).toBe("content_type:zebra");
  });

  it("collects dangling reference warnings", () => {
    const schema = normalizeSchema({
      entities: [
        simpleEntity("content_type", "post", [
          simpleField("author", "reference", { referenceTo: ["nonexistent"] }),
        ]),
      ],
    });
    const graph = buildDependencyGraph(schema);
    expect(graph.warnings.length).toBeGreaterThan(0);
    expect(graph.warnings[0]).toContain("Dangling reference");
  });
});

describe("create-plan (comprehensive)", () => {
  it("empty diff produces empty plan", () => {
    const schema = normalizeSchema({ entities: [simpleEntity("content_type", "page")], metadata: {} });
    const diff = diffSchemas(schema, schema);
    const plan = createPlan(diff);
    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.total).toBe(0);
  });

  it("summary counts are accurate", () => {
    const local = normalizeSchema({
      entities: [simpleEntity("content_type", "page", [simpleField("title"), simpleField("slug")])],
    });
    const remote = normalizeSchema({ entities: [], metadata: {} });
    const diff = diffSchemas(local, remote);
    const plan = createPlan(diff);
    expect(plan.summary.creates).toBeGreaterThan(0);
    expect(plan.summary.total).toBe(plan.operations.length);
  });

  it("plan with only deletions", () => {
    const local = normalizeSchema({ entities: [], metadata: {} });
    const remote = normalizeSchema({ entities: [simpleEntity("content_type", "old")], metadata: {} });
    const diff = diffSchemas(local, remote);
    const plan = createPlan(diff);
    expect(plan.summary.deletes).toBeGreaterThan(0);
    expect(plan.summary.creates).toBe(0);
  });
});

describe("error classes", () => {
  it("CoreError has code property", () => {
    const err = new CoreError("test", "TEST_CODE");
    expect(err.code).toBe("TEST_CODE");
    expect(err.name).toBe("CoreError");
    expect(err.message).toBe("test");
  });

  it("ValidationError uses VALIDATION_ERROR code", () => {
    const err = new ValidationError("bad input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.name).toBe("ValidationError");
  });

  it("DependencyCycleError uses DEPENDENCY_CYCLE code", () => {
    const err = new DependencyCycleError("cycle found");
    expect(err.code).toBe("DEPENDENCY_CYCLE");
    expect(err.name).toBe("DependencyCycleError");
  });
});

describe("isPrimitiveFieldKind", () => {
  it("returns true for primitive kinds", () => {
    for (const kind of ["text", "number", "boolean", "date", "json", "enum", "file", "link", "markdown", "rich_text", "json_rte"] as const) {
      expect(isPrimitiveFieldKind(kind)).toBe(true);
    }
  });

  it("returns false for complex kinds", () => {
    for (const kind of ["reference", "group", "modular_blocks", "global_field", "taxonomy"] as const) {
      expect(isPrimitiveFieldKind(kind)).toBe(false);
    }
  });
});
