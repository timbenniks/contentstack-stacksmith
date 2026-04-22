# Internal Skills Package

Universal Agent Skills package for the full Contentstack models-as-code lifecycle.

It ships standard `skills/` resources for local development inside this monorepo. This workspace package is private and is not intended for separate npm publication.

## Included skills

### `contentstack-stacksmith`

Manages the complete models-as-code workflow:
- **Scaffold** new projects with `csdx stacksmith:init`
- **Author** content types and global fields using the TypeScript DSL
- **Build** and validate schemas with `csdx stacksmith:build`
- **Diff** local models against a remote stack
- **Plan** dependency-aware rollouts with risk assessment
- **Apply** low-risk additive changes with safety guardrails
- **Troubleshoot** common build and validation errors
- **Refactor** models — extract global fields, reorganize files, split content types

### `contentstack-stacksmith-import`

Reverse-engineers an existing Contentstack stack into TypeScript DSL code:
- Fetch content types and global fields from a live stack via CMA
- Map CMA field schemas to DSL builder calls
- Generate one file per entity, a registry barrel, and a config file
- Validate parity with `stacksmith:plan` after import

### `contentstack-stacksmith-review`

Reviews model definitions for quality, consistency, and best practices:
- Naming conventions (snake_case UIDs, singular nouns, descriptive names)
- Required field analysis (missing required on title/slug fields)
- Reference quality (overly broad targets, circular chains)
- Global field reuse (duplicated field groups that should be extracted)
- Structural issues (oversized content types, deep nesting, singleton misuse)
- Completeness (missing descriptions, undocumented fields)

### `contentstack-stacksmith-migrate`

Generates step-by-step migration strategies for blocked operations:
- Field renames with data migration scripts
- Field type changes with compatibility guidance
- Content type and field deletion with safety checks
- Required constraint tightening with entry backfill
- Reference target changes with orphan detection
- Rollback guidance for each step

### `contentstack-stacksmith-docs`

Generates human-readable documentation from compiled schemas:
- **Model overview** — summary table of all entities
- **Field inventory** — detailed data dictionary per entity
- **Dependency diagram** — Mermaid diagrams of entity relationships
- **Content editor guide** — plain-language docs for non-technical users

## Using the package

This package uses the standard Agent Skills `skills/` directory layout. Use it from the local workspace directory when you want to wire these skills into a compatible harness during development.

## Package structure

```text
packages/agents/
├── package.json
├── README.md
└── skills/
    ├── contentstack-stacksmith/
    │   ├── SKILL.md
    │   └── references/
    │       ├── dsl-api.md
    │       ├── cli-reference.md
    │       ├── project-conventions.md
    │       └── common-patterns.md
    ├── contentstack-stacksmith-import/
    │   ├── SKILL.md
    │   └── references/
    │       └── field-mapping.md
    ├── contentstack-stacksmith-review/
    │   ├── SKILL.md
    │   └── references/
    │       └── review-checklist.md
    ├── contentstack-stacksmith-migrate/
    │   ├── SKILL.md
    │   └── references/
    │       └── migration-strategies.md
    └── contentstack-stacksmith-docs/
        ├── SKILL.md
        └── references/
            └── output-formats.md
```
