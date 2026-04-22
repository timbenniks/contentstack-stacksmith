# Architecture

The monorepo is split into a small set of packages with one clear pipeline:

`DSL definitions -> normalized schema artifact -> diff and plan -> Contentstack adapters`

## Package responsibilities

- `packages/core`: shared schema types, normalization, dependency graph, diff, and plan assembly
- `packages/dsl`: TypeScript authoring API and compilation into the core schema
- `packages/validators`: schema and diff validation plus risk classification
- `packages/cli`: external Contentstack CLI plugin and service layer
- `packages/agents`: universal Agent Skills package for agent-assisted models-as-code workflows
- `packages/test-utils`: reusable fixtures and snapshots
- `apps/example-project`: dogfooding project for local builds and command tests

## Runtime flow

1. Model files export plain definitions through the DSL.
2. The CLI loads the configured models entry with a TypeScript runtime loader.
3. The DSL compiles those definitions into the normalized schema artifact.
4. Core utilities compute dependency graph and diff results.
5. Validators classify blocked vs low-risk operations.
6. The CLI renders build, diff, and plan output or executes low-risk apply steps against Contentstack.
