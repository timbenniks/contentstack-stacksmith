# Programmatic API

The main library package can be used programmatically without the CLI. It exports the DSL plus the supported schema, diff, plan, and validation helpers. The lower-level workspace packages are internal and are not meant to be installed separately.

## `@timbenniks/contentstack-stacksmith`

Install the main library package once:

```bash
npm install @timbenniks/contentstack-stacksmith
```

### `normalizeSchema(input)`

Normalizes a raw schema input into a deterministic `SchemaArtifact`. Generates entity and field IDs, extracts dependencies, deduplicates them, and sorts entities.

```typescript
import { normalizeSchema } from "@timbenniks/contentstack-stacksmith";

const schema = normalizeSchema({
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
  metadata: { origin: "dsl" },
});
// Returns SchemaArtifact with computed IDs and dependencies
```

### `diffSchemas(local, remote?)`

Compares two schema artifacts and generates a list of operations representing the differences.

```typescript
import { diffSchemas } from "@timbenniks/contentstack-stacksmith";

const diff = diffSchemas(localSchema, remoteSchema);
// Returns DiffResult with operations and warnings

// Without remote (compares against empty baseline)
const localDiff = diffSchemas(localSchema);
```

### `buildDependencyGraph(schema)`

Builds a dependency graph from a schema artifact. Uses Kahn's algorithm for topological sorting and depth-first search for cycle detection.

```typescript
import { buildDependencyGraph } from "@timbenniks/contentstack-stacksmith";

const graph = buildDependencyGraph(schema);
// graph.order — entity IDs in topological order (dependencies first)
// graph.reverseOrder — reverse topological order (dependents first)
// graph.cycles — detected circular dependencies (empty if none)
// graph.nodes — all entity references
// graph.edges — all dependency edges
```

### `createPlan(diff, graph?, findings?)`

Assembles a complete execution plan from a diff result, optional dependency graph, and optional validation findings.

```typescript
import { createPlan, diffSchemas, buildDependencyGraph } from "@timbenniks/contentstack-stacksmith";
import { validateSchema, validateDiff } from "@timbenniks/contentstack-stacksmith";

const diff = diffSchemas(localSchema, remoteSchema);
const graph = buildDependencyGraph(localSchema);
const findings = [...validateSchema(localSchema), ...validateDiff(diff)];
const plan = createPlan(diff, graph, findings);
// Returns PlanArtifact with ordered operations, summary, and findings
```

### `toCanonicalJson(value)`

Converts any value to a canonical JSON string with sorted object keys and 2-space indentation. Used internally for deterministic hashing and comparison.

```typescript
import { toCanonicalJson } from "@timbenniks/contentstack-stacksmith";

const json = toCanonicalJson({ z: 1, a: 2 });
// '{\n  "a": 2,\n  "z": 1\n}'
```

### Exported types

The package exports the normalized schema types most likely to appear in application code:

```typescript
import type {
  SchemaArtifact,
  CompiledEntity,
  CompiledContentType,
  CompiledGlobalField,
  CompiledField,
  CompiledBlock,
  NormalizableFieldInput,
  NormalizableBlockInput,
  DependencyRef,
  TaxonomyRef,
  FieldKind,
  ContentTypeOptions,
  EnumChoiceAdvanced,
} from "@timbenniks/contentstack-stacksmith";
```

- `ContentTypeOptions` — typed interface for `CompiledContentType.options` (see [Content Type Options](/reference/dsl-api#content-type-options)).
- `EnumChoiceAdvanced` — `{ key: string; value: string }` pair used when `CompiledField.enumAdvanced` is `true`.
- `CompiledBlock` — `{ uid, title, fields? }` for inline blocks OR `{ uid, title, globalFieldRef }` for blocks that reuse a global field's schema.
- `DependencyRef.reason` — `"reference" | "global_field" | "modular_block_reference"`. The `modular_block_reference` reason is emitted when a modular block embeds a global field.

### DSL authoring helpers

The same package also exports all [entity helpers](/reference/dsl-api#entity-helpers) and [field builders](/reference/dsl-api#field-builders), plus compilation functions.

### `compileDefinitions(definitions)`

Compiles an array of `ModelDefinition` objects into a normalized `SchemaArtifact`. Throws `ValidationError` if:

- Duplicate entity UIDs exist across the input.
- Any `globalField()` field references a UID that isn't defined by any `defineGlobalField(...)` in the input.
- Any `reference()` field's `to` targets a content-type UID that isn't defined in the input.
- Any field declares `previousUid` but is nested inside a `group()` or `modularBlocks()` (Contentstack CMA does not support in-place renames of nested sub-fields).

The error message lists every offending reference at once, so you fix them all in one pass rather than discovering them one at a time during `plan`/`apply`.

```typescript
import { compileDefinitions, defineContentType, defineGlobalField, text, reference, globalField } from "@timbenniks/contentstack-stacksmith";

const author = defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});

const seo = defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});

const blogPost = defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});

const schema = compileDefinitions([author, seo, blogPost]);
// Returns SchemaArtifact
```

### `compileModelRegistry(registry)`

Compiles a `ModelRegistry` (as returned by `defineModels`) into a `SchemaArtifact`. Convenience wrapper that flattens the registry and calls `compileDefinitions` — including the same forward-reference, duplicate-UID, and nested-`previousUid` checks described above.

```typescript
import { compileModelRegistry, defineModels } from "@timbenniks/contentstack-stacksmith";

const registry = defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});

const schema = compileModelRegistry(registry);
```

### `flattenDefinitions(registry)`

Flattens a `ModelRegistry` into a single array of `ModelDefinition` objects. Combines `definitions`, `globalFields`, and `contentTypes` arrays in that order.

```typescript
import { flattenDefinitions } from "@timbenniks/contentstack-stacksmith";

const definitions = flattenDefinitions(registry);
// Returns ModelDefinition[]
```

### Validation helpers

The same package also exports schema validation, diff validation, and plan-level risk analysis.

### `validateSchema(schema)`

Validates a `SchemaArtifact` for structural issues. Returns an array of `ValidationFinding` objects.

```typescript
import { validateSchema } from "@timbenniks/contentstack-stacksmith";

const findings = validateSchema(schema);
for (const finding of findings) {
  console.log(`[${finding.level}] ${finding.code}: ${finding.message}`);
}
```

**Checks performed:**

| Code | Level | Trigger |
|------|-------|---------|
| `DUPLICATE_UID` | blocker | Two entities share the same kind:uid combination, or two fields within an entity share the same uid |
| `MISSING_REFERENCE_TARGET` | blocker | A reference field points to a content type that doesn't exist in the schema |
| `MISSING_GLOBAL_FIELD` | blocker | A `global_field` field, or a modular block using `globalFieldRef`, points at a global field UID that isn't defined in the schema |
| `EMPTY_MODULAR_BLOCKS` | medium | A modular_blocks field has no blocks defined |

### `validateDiff(diff)`

Validates a `DiffResult` for breaking changes and classifies each operation by risk level.

```typescript
import { validateDiff } from "@timbenniks/contentstack-stacksmith";

const findings = validateDiff(diff);
```

**Checks performed:**

| Code | Level | Trigger |
|------|-------|---------|
| `DESTRUCTIVE_CHANGE` | blocker | `delete_entity` or `remove_field` operation |
| `BREAKING_FIELD_MUTATION` | blocker | `update_field` that changes field type, reference targets, or tightens required (false → true) |
| `RISKY_REQUIRED_FIELD` | high | `add_field` where the new field is required |
| `SAFE_FIELD_UPDATE` | low | `update_field` with non-breaking changes (display name, description, etc.) |
| `SAFE_ADDITIVE_CHANGE` | low | `add_field` where the new field is optional |
| `SAFE_ENTITY_CHANGE` | low | `create_entity`, `update_entity`, or `reorder_fields` |

### `analyzePlanRisk(plan)`

Produces summary-level risk findings for a complete plan.

```typescript
import { analyzePlanRisk } from "@timbenniks/contentstack-stacksmith";

const findings = analyzePlanRisk(plan);
```

| Code | Level | Trigger |
|------|-------|---------|
| `PLAN_BLOCKED` | blocker | Plan contains one or more blocked operations |
| `HIGH_RISK_OPERATIONS` | high | Plan contains one or more high-risk operations |
