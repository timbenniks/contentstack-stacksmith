# `@timbenniks/contentstack-stacksmith`

TypeScript DSL for defining Contentstack content types and global fields as code.

**Documentation:** https://contentstack-stacksmith-docs-g1gh.vercel.app/

## Main Exports

- Entity helpers: `defineContentType`, `defineGlobalField`, `defineModels`, `defineModelsConfig`
- Compilation helpers: `compileDefinitions`, `compileModelRegistry`, `flattenDefinitions`
- Programmatic helpers: `normalizeSchema`, `diffSchemas`, `buildDependencyGraph`, `createPlan`, `validateSchema`, `validateDiff`, `analyzePlanRisk`, `toCanonicalJson`
- Field builders: `text`, `number`, `boolean`, `date`, `json`, `file`, `link`, `markdown`, `richText`, `jsonRte`, `reference`, `group`, `enumField`, `modularBlocks`, `globalField`, `taxonomy`
- Type exports for model and field definitions

## Example

```ts
import {
  defineContentType,
  defineGlobalField,
  defineModels,
  globalField,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";

const seo = defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});

const blogPost = defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});

export default defineModels({
  contentTypes: [blogPost],
  globalFields: [seo],
});
```

## Modular block shapes

Each entry in `modularBlocks({ blocks: [...] })` is one of two shapes:

```ts
modularBlocks("page_content", {
  blocks: [
    // Inline block: declares its own fields
    { uid: "hero", title: "Hero", fields: [text("heading")] },

    // Global-field-reference block: reuses an existing global field as a block
    { uid: "cta_banner", title: "CTA Banner", globalFieldRef: "cta" },
  ],
})
```

The global-field-reference shape maps to Contentstack's CMA block `reference_to: "<global_field_uid>"` — the block reuses the referenced global field's schema.

## Field option coverage

All field builders support the following common options: `title`, `required`, `unique`, `multiple`, `nonLocalizable`, `description`, `defaultValue`, `errorMessages` (arbitrary key→message map), `metadata`, `previousUid` (rename this field from an old uid — see below).

Additional per-builder options:

- `text` — `multiline`, `format`, `formatErrorMessage`
- `date` — `startDate`, `endDate`
- `file` — `extensions` (file type allowlist)
- `reference` — `to` (required), `refMultipleContentTypes`
- `enumField` — `choices` (strings OR `{ key, value }` pairs), `advanced`, `displayType`, `minInstance`, `maxInstance`
- `jsonRte` — `richTextType`, `referenceTo`, `plugins`
- `taxonomy` — `taxonomies[]` with `taxonomy_uid`, `max_terms`, `mandatory`, `non_localizable`

## Content type options

`defineContentType(uid, { options: ... })` accepts a typed `ContentTypeOptions` object:

```ts
defineContentType("page", {
  title: "Page",
  fields: [/* ... */],
  options: {
    title: "title",
    publishable: true,
    is_page: true,
    singleton: false,
    sub_title: ["url"],
    url_pattern: "/:title",
    url_prefix: "/",
  },
})
```

## Renaming fields

Set `previousUid` on a top-level field to rename it without losing entry data. The diff engine emits a single `rename_field` op (low-risk) instead of remove + add:

```ts
text("display_name", { previousUid: "full_name" })
```

Restrictions: not allowed on fields nested inside `group()` or `modularBlocks()` (CMA limitation); throws at compile time. Content-type UIDs themselves cannot be renamed via this mechanism. Once a rename has landed, drop `previousUid` on your next edit — it's vestigial.

## Notes

- UIDs are validated and must be lowercase snake_case.
- `defineModelsConfig()` fills in sensible defaults for `modelsEntry`, `outDir`, and `strict`.
- When compiling content types, the DSL ensures a required `title` field exists in the normalized schema.
- `reference()` requires at least one target content type.
- `enumField()` requires at least one choice; use `advanced: true` with `{ key, value }` pairs when you want distinct display labels.
- A modular block entry declares either `fields` OR `globalFieldRef` — never both.
- `compileModelRegistry()` / `compileDefinitions()` throw `ValidationError` at compile time for undefined `globalField` references and undefined `reference()` targets (previously surfaced only at plan time). The error message lists every offending reference at once.

Use this package for both IDE-friendly model authoring and programmatic schema tooling.
