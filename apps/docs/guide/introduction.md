# What is Contentstack Stacksmith?

Contentstack Stacksmith brings infrastructure-as-code principles to your Contentstack content models. Instead of managing content types and global fields through the Contentstack dashboard, you define them in TypeScript, review changes in pull requests, and apply them through a CLI.

## What you get

- **TypeScript DSL** for defining content types and global fields with full type safety and autocompletion
- **Normalized schema artifacts** that are deterministic, diffable, and version-controllable
- **Dependency-aware planning** that automatically resolves creation order and detects circular dependencies
- **Safe, additive apply** that only executes low-risk operations like creating new entities and adding fields
- **Breaking change detection** that blocks destructive operations like deleting content types or changing field types
- **Lossless stack import** that pulls an existing Contentstack stack down into DSL files with full CMA property coverage

## Package overview

The release surface is intentionally small:

| Package | Purpose |
|---------|---------|
| `@timbenniks/contentstack-stacksmith` | TypeScript DSL plus schema normalization, diffing, planning, and validation |
| `@timbenniks/contentstack-stacksmith-cli` | Contentstack CLI plugin with `stacksmith:*` commands |

The lower-level workspace packages are internal implementation details and are not meant to be installed separately.

## Current phase

This is **Phase 1** of the toolkit. The apply command currently only supports **additive, low-risk operations** such as creating new content types, creating new global fields, and adding new fields. Destructive operations like deleting content types, removing fields, or changing field types are detected and blocked. See the [Safety Model](./safety-model.md) page for the full list.

## Next steps

- Walk through the [Getting Started](./getting-started.md) guide to scaffold your first project.
- Read about [the pipeline](./core-concepts.md) to understand how compile → diff → plan → apply works end-to-end.
- Explore the [DSL reference](/reference/dsl-api) for every field builder and option.
