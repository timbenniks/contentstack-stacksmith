---
name: contentstack-stacksmith-import
description: Reverse-engineers an existing Contentstack stack into TypeScript DSL model definitions. Use when asked to import, pull, or convert existing content types and global fields from a live stack into models-as-code.
license: MIT
---

# Contentstack Stacksmith Import

Read this reference before importing:

- [Field mapping](references/field-mapping.md)

## Use this skill when

- the user wants to adopt models-as-code on an existing Contentstack stack
- the user wants to pull content types from a live stack into TypeScript
- the user wants to reverse-engineer or export their stack's schema as DSL code
- the user wants to bootstrap a models project from an existing stack instead of starting from scratch

---

## Workflow: Import from stack

### Prerequisites

The user needs:
- A Contentstack management token configured via `csdx auth:tokens:add`
- The stack API key
- The token alias

### Steps

1. **Scaffold project** (if no project exists yet):
   - Run `csdx stacksmith:init` to create the project structure.
   - Or create `contentstack.stacksmith.config.ts` and `src/models/index.ts` manually.

2. **Fetch remote schema**:
   - Run `csdx stacksmith:plan --stack <api_key> --token-alias <alias>` to fetch the remote state.
   - Read the plan output to understand what content types and global fields exist on the stack.
   - Alternatively, use the Contentstack CMA API directly:
     - `GET /v3/content_types` — lists all content types with their schemas
     - `GET /v3/global_fields` (API version 3.2) — lists all global fields

3. **Generate global field files first** (dependencies must exist before dependents):
   - For each global field on the stack, create a TypeScript file using `defineGlobalField()`.
   - Map each CMA field to the corresponding DSL builder (see [field mapping](references/field-mapping.md)).
   - Place files in `src/models/global-fields/<uid>.ts`.

4. **Generate content type files**:
   - For each content type on the stack, create a TypeScript file using `defineContentType()`.
   - Map each CMA field to the corresponding DSL builder.
   - For reference fields, use `reference("uid", { to: ["target_uid"] })`.
   - For global field embeds, use `globalField("uid", { ref: "global_field_uid" })`.
   - Place files in `src/models/content-types/<uid>.ts`.

5. **Generate the registry**:
   - Create or update `src/models/index.ts` with imports for all entities.
   - Register them in `defineModels({ contentTypes: [...], globalFields: [...] })`.

6. **Validate**:
   - Run `csdx stacksmith:build --cwd <project-root>`.
   - Fix any validation errors (duplicate UIDs, missing references).

7. **Confirm parity**:
   - Run `csdx stacksmith:plan --stack <api_key> --token-alias <alias>`.
   - The plan should show zero operations if the import matches the remote state exactly.
   - If there are differences, adjust the DSL definitions to match.

---

## Field mapping rules

When converting CMA schema fields to DSL builders:

| CMA `data_type` | DSL builder | Notes |
|------------------|-------------|-------|
| `text` | `text()` | |
| `number` | `number()` | |
| `boolean` | `boolean()` | |
| `isodate` | `date()` | CMA uses `isodate`, DSL uses `date` |
| `json` | `json()` | Also used for rich text fields |
| `reference` | `reference()` | Map `reference_to` → `{ to: [...] }` |
| `global_field` | `globalField()` | Map to `{ ref: "uid" }` |
| `group` | `group()` | Recursively map nested `schema` → `fields` |
| `blocks` | `modularBlocks()` | Map each block's `schema` → `fields` |
| `file` | `json()` | No native file builder — use `json` as fallback |
| `link` | `json()` | No native link builder — use `json` as fallback |

### Option mapping

| CMA field property | DSL option | Notes |
|--------------------|-----------|-------|
| `mandatory` | `required` | |
| `unique` | `unique` | |
| `multiple` | `multiple` | |
| `display_name` | `title` | Only set if different from auto-generated title |
| `field_metadata.description` | `description` | |
| `enum.choices` | `choices` (on `enumField`) | Extract string values from choice objects |
| `reference_to` | `to` (on `reference`) | Array of content type UIDs |

---

## Handling edge cases

### Fields without a DSL equivalent

Some CMA field types don't have a direct DSL builder (e.g., `file`, `link`, `markdown`). Use `json()` as a fallback and add a comment explaining the original type:

```ts
json("hero_image"), // CMA type: file
json("external_link"), // CMA type: link
```

### Enum fields

CMA enums can have choices as strings or objects with `value` properties. Always extract the string value:

```ts
// CMA: { enum: { choices: [{ value: "draft" }, { value: "published" }] } }
enumField("status", { choices: ["draft", "published"] })
```

### Nested groups and modular blocks

Recursively apply the same field mapping rules to nested `schema` arrays within groups and modular block definitions.

### System fields

Skip CMA system fields that are auto-managed (e.g., `title` with `uid: "title"` that Contentstack adds automatically). The DSL handles these implicitly.

### Content type options

Map CMA content type `options` to the DSL `options` parameter:

```ts
// CMA: { options: { singleton: true } }
defineContentType("site_settings", {
  options: { singleton: true },
  // ...
})
```

---

## Output structure

After import, the project should look like:

```text
contentstack.stacksmith.config.ts
src/
  models/
    index.ts                    # Registry with all imports
    content-types/
      article.ts
      author.ts
      page.ts
    global-fields/
      seo.ts
      hero.ts
```

---

## Post-import checklist

1. `stacksmith:build` passes with no errors.
2. `stacksmith:plan` against the source stack shows zero operations (full parity).
3. All global fields are imported before content types that reference them.
4. All reference targets exist in the registry.
5. File names use kebab-case, UIDs use snake_case.
6. Review generated code for any `json()` fallbacks and add comments explaining the original CMA type.
