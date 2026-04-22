# Core Concepts

## The pipeline

Every operation follows this pipeline:

```
TypeScript Definitions
        |
        v
   [ Compile ]        DSL → Core schema format
        |
        v
   [ Normalize ]      Deterministic IDs, sorting, dependency extraction
        |
        v
   [ Validate ]       Check for missing references, duplicates, etc.
        |
        v
   [ Diff ]           Compare local schema to remote stack
        |
        v
   [ Plan ]           Order operations, classify risk, detect blocked changes
        |
        v
   [ Apply ]          Execute only safe, additive operations
```

Each stage is handled by a separate package, and you can use any stage independently through the [Programmatic API](/reference/programmatic-api).

## Content types and global fields

Contentstack has two kinds of content model entities:

- **Content Types** define the structure of entries. Think of them as database tables. Each content type has a unique identifier (UID), a title, and a set of fields. Examples: `blog_post`, `author`, `product`.

- **Global Fields** are reusable field groups that can be embedded into multiple content types. They're defined once and referenced by UID. When you update a global field, every content type that uses it gets the update. Examples: `seo`, `social_media`, `address`.

In the DSL, you create these with `defineContentType` and `defineGlobalField` respectively.

## The normalized schema

When your TypeScript definitions are compiled, they produce a **normalized schema** — a deterministic JSON representation of all your entities and their fields.

**Entity IDs** follow the format `{kind}:{uid}`:

```
content_type:blog_post
global_field:seo
```

**Field IDs** follow the format `{entityId}.field:{uid}`:

```
content_type:blog_post.field:title
content_type:blog_post.field:slug
global_field:seo.field:meta_title
```

**Deterministic output:**

- Entities are sorted by kind (content types before global fields within the same letter) and then by UID alphabetically
- Fields preserve the order you declared them in your TypeScript definition via an explicit `order` property (0-indexed)
- Object keys in JSON output are sorted alphabetically for stable diffs and hashing

This determinism ensures that the same TypeScript definitions always produce the exact same `schema.json`, making it safe to commit artifacts to version control and compare them across builds.

## Dependency system

The toolkit automatically tracks dependencies between entities:

- A **reference field** pointing to a content type creates a dependency from the entity containing the field to the referenced content type
- A **global field** embedded in a content type creates a dependency from the content type to the global field
- **Modular blocks** that contain reference or global field fields also create dependencies
- **Modular blocks that reference a global field** (via `globalFieldRef`) create a `modular_block_reference` dependency

Dependencies are used for:

1. **Topological sorting** — Entities are ordered so that dependencies are created before the entities that depend on them. For example, if `blog_post` references `author`, the `author` content type is created first.
2. **Cycle detection** — The dependency graph is checked for circular dependencies. If content type A references content type B which references content type A, this cycle is detected and reported.
3. **Operation ordering** — When applying changes to a remote stack, operations are executed in dependency order to ensure referenced entities exist before dependents are created.

See the [Safety Model](./safety-model.md) for how risk levels are assigned to each operation the diff produces.
