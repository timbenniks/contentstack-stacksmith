---
name: contentstack-stacksmith-docs
description: Generates human-readable documentation from Contentstack model definitions — entity overviews, field inventories, dependency diagrams, and content editor guides. Use when asked to document, diagram, or explain the content model.
license: MIT
---

# Contentstack Stacksmith Docs

Read this reference for output format templates:

- [Output formats](references/output-formats.md)

## Use this skill when

- the user wants documentation of their content model
- the user wants a visual diagram of entity relationships
- the user wants to onboard content editors to the schema
- the user wants a field inventory or data dictionary
- the user needs to explain the content model to stakeholders
- the user asks "what content types do we have?" or "how are they connected?"

---

## Workflow: Generate documentation

### Steps

1. **Ensure a build exists**:
   - Check if `schema.json` exists in the configured `outDir` (default `.contentstack/models/`).
   - If not, run `csdx stacksmith:build --cwd <project-root>` first.

2. **Read the schema artifact**:
   - Parse `schema.json` to get all entities and their fields.
   - Each entity has: `id`, `kind`, `uid`, `title`, `description`, `fields`, `dependencies`.
   - Each field has: `uid`, `displayName`, `kind`, `required`, `unique`, `multiple`, `description`, `dependencies`.

3. **Choose output format** based on what the user needs:
   - **Model overview** — summary table of all entities
   - **Field inventory** — detailed field tables per entity
   - **Dependency diagram** — Mermaid diagram of entity relationships
   - **Content editor guide** — plain-language documentation for non-technical users
   - **Full documentation** — all of the above combined

4. **Generate the documentation** using the templates in [output-formats.md](references/output-formats.md).

5. **Write to file or display** depending on user preference.

---

## Output formats

### Model overview

A high-level table of all content types and global fields.

Columns: entity name, kind, field count, description, dependencies.

Useful for: architecture reviews, onboarding developers.

### Field inventory

Per-entity table of every field with its type, constraints, and description.

Columns: field UID, display name, type, required, unique, multiple, description.

Useful for: data dictionaries, API documentation, frontend development.

### Dependency diagram

A Mermaid diagram showing how entities relate to each other through references and global field usage.

Useful for: architecture reviews, understanding coupling, onboarding.

### Content editor guide

Plain-language description of each content type written for content editors, not developers. Explains what each type is for, which fields to fill, and which are required.

Useful for: onboarding content editors, training documentation.

---

## Reading schema.json

The `schema.json` file is the compiled output from `stacksmith:build`. Its structure:

```json
{
  "schemaVersion": 1,
  "entities": [
    {
      "id": "content_type:blog_post",
      "kind": "content_type",
      "uid": "blog_post",
      "title": "Blog Post",
      "description": "A blog article.",
      "fields": [
        {
          "id": "content_type:blog_post.field:title",
          "uid": "title",
          "displayName": "Title",
          "kind": "text",
          "order": 0,
          "required": true,
          "unique": false,
          "multiple": false,
          "dependencies": []
        },
        {
          "id": "content_type:blog_post.field:author",
          "uid": "author",
          "displayName": "Author",
          "kind": "reference",
          "order": 3,
          "required": true,
          "unique": false,
          "multiple": false,
          "dependencies": [
            { "id": "content_type:author", "kind": "reference" }
          ]
        }
      ],
      "dependencies": [
        { "id": "content_type:author", "kind": "reference" },
        { "id": "global_field:seo", "kind": "global_field" }
      ]
    }
  ]
}
```

### Key fields for documentation

- `entity.title` — human-readable name
- `entity.description` — explains the entity's purpose
- `entity.dependencies` — shows what this entity depends on
- `field.kind` — the field type (text, number, reference, etc.)
- `field.required` / `field.unique` / `field.multiple` — constraints
- `field.dependencies` — for reference and global field usage

---

## Reading manifest.json

The `manifest.json` provides build metadata:

```json
{
  "version": "0.1.0",
  "compiler": "@timbenniks/contentstack-stacksmith",
  "compilerVersion": "0.1.0",
  "sourceFiles": [
    "src/models/content-types/author.ts",
    "src/models/content-types/blog-post.ts",
    "src/models/global-fields/seo.ts"
  ],
  "schemaHash": "abc123..."
}
```

Useful for:
- Listing all source files in documentation
- Tracking which version of the compiler generated the schema
- Detecting changes via `schemaHash`

---

## Keeping docs up to date

Documentation should be regenerated after any model change:

1. Edit model files.
2. Run `stacksmith:build`.
3. Regenerate documentation from the new `schema.json`.

Consider adding documentation generation to the project's build script or CI pipeline.
