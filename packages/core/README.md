# Internal Core Package

Internal schema, normalization, diff, dependency, and planning primitives for the Contentstack models workflow.

This workspace package is private. Public consumers should use `@timbenniks/contentstack-stacksmith`, which re-exports the supported programmatic API.

## Public Exports

- Schema and artifact types from `./schema/types`
- `normalizeSchema`, `toCanonicalJson`, and `isPrimitiveFieldKind`
- `buildDependencyGraph`
- `diffSchemas`
- `createPlan`
- `CoreError`, `ValidationError`, and `DependencyCycleError`

## What This Package Handles

- Canonical schema normalization with deterministic entity ordering
- Stable entity and field IDs
- Dependency extraction for references and embedded global fields
- Diff generation between local and remote schemas
- Dependency-aware execution ordering for plan operations
- Shared TypeScript types consumed by the DSL, validators, CLI, and tests

## Typical Usage

```ts
import { buildDependencyGraph, createPlan, diffSchemas, normalizeSchema } from "@timbenniks/contentstack-stacksmith";

const local = normalizeSchema({
  entities: [
    {
      kind: "content_type",
      uid: "author",
      title: "Author",
      fields: [{ uid: "title", displayName: "Title", kind: "text", required: true }],
    },
  ],
});

const remote = normalizeSchema({ entities: [] });
const diff = diffSchemas(local, remote);
const graph = buildDependencyGraph(local);
const plan = createPlan(diff, graph);
```

This package is intentionally Contentstack-domain aware, but transport-agnostic. It knows how to reason about schemas and plans, not how to call the CMA.
