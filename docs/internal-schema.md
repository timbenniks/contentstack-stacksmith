# Internal Schema

The internal schema is the shared contract between the DSL and the CLI.

## Entity identifiers

- Content type IDs: `content_type:{uid}`
- Global field IDs: `global_field:{uid}`
- Field IDs: `{entityId}.field:{uid}`

## UID format

All UIDs must match `^[a-z][a-z0-9_]*$` — start with a lowercase letter, contain only lowercase letters, numbers, and underscores.

## Deterministic rules

- Entities are sorted by kind (alphabetically: `content_type` before `global_field`) then by UID
- Fields preserve author order through explicit `order`
- Dependencies are stored explicitly on fields and entities
- Canonical JSON output is used for stable artifact generation and hashing

## FieldKind

```
"text" | "number" | "boolean" | "date" | "json"
| "file" | "link" | "markdown" | "rich_text" | "json_rte"
| "reference" | "group" | "enum" | "modular_blocks"
| "global_field" | "taxonomy"
```

## Entity shapes

- `CompiledContentType` — extends `CompiledEntity` with optional typed `options: ContentTypeOptions { title?, publishable?, is_page?, singleton?, sub_title?, url_pattern?, url_prefix?, [key]: unknown }`
- `CompiledGlobalField` — extends `CompiledEntity`
- `CompiledField` — includes `id`, `order`, `dependencies`, `nonLocalizable?`, and optional kind-specific fields:
  - `referenceTo` (reference, json_rte)
  - `refMultipleContentTypes` (reference)
  - `globalFieldRef` (global_field)
  - `enumChoices` — `string[]` OR `EnumChoiceAdvanced[] { key, value }` (enum)
  - `enumAdvanced` (enum, flags advanced mode)
  - `minInstance`, `maxInstance` (enum)
  - `fields` (group)
  - `blocks` (modular_blocks) — each `CompiledBlock` is `{ uid, title, fields }` OR `{ uid, title, globalFieldRef }`
  - `richTextType`, `plugins` (rich_text, json_rte) — `richTextType` preserves CMA values such as `basic`, `advanced`, and custom editor modes
  - `taxonomies` (taxonomy) — array of `TaxonomyRef { taxonomy_uid, max_terms?, mandatory?, multiple?, non_localizable? }`
  - `format`, `errorMessages: Record<string, string>`, `multiline` (text constraints)
  - `displayType` (enum display)
  - `startDate`, `endDate` (date constraints)
  - `extensions` (file field allowlist)
- `DependencyRef` — tracks references between entities. `reason` includes `"modular_block_reference"` when a modular block embeds a global field.
- `PlanOperation` — migration operation with risks and dependencies

## PlanSummary

Includes: `total`, `creates`, `updates`, `deletes`, `blocked`, `lowRisk`, `mediumRisk`, `highRisk`

The CLI only compares and applies normalized schema artifacts. It does not parse TypeScript ASTs directly.
