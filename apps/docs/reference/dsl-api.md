# DSL API Reference

Complete reference for `@timbenniks/contentstack-stacksmith`. Every entity helper, field builder, and option.

## Entity helpers

### `defineContentType(uid, definition)`

Creates a content type definition.

```typescript
import { defineContentType, text, reference } from "@timbenniks/contentstack-stacksmith";

const blogPost = defineContentType("blog_post", {
  title: "Blog Post",
  description: "A blog post entry with author and SEO metadata.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
  ],
  options: {
    singleton: false,
  },
  metadata: {
    labels: ["content"],
  },
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique identifier for the content type. Must be unique across all content types. Use `snake_case`. |
| `definition.title` | `string` | Human-readable display name shown in the Contentstack dashboard. |
| `definition.description` | `string?` | Optional description for the content type. |
| `definition.fields` | `FieldDefinition[]` | Array of field definitions created with field builder functions. |
| `definition.options` | `ContentTypeOptions?` | Optional Contentstack content type options. See [Content Type Options](#content-type-options). |
| `definition.metadata` | `NormalizedMetadata?` | Optional metadata attached to the entity (labels, custom data). |

**Returns:** `ContentTypeDefinition`

### `defineGlobalField(uid, definition)`

Creates a global field definition. Global fields are reusable field groups that can be embedded in multiple content types.

```typescript
import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

const seo = defineGlobalField("seo", {
  title: "SEO",
  description: "SEO metadata reused across content types.",
  fields: [
    text("meta_title"),
    text("meta_description"),
  ],
  metadata: {
    labels: ["shared"],
  },
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique identifier for the global field. Must be unique across all global fields. Use `snake_case`. |
| `definition.title` | `string` | Human-readable display name. |
| `definition.description` | `string?` | Optional description. |
| `definition.fields` | `FieldDefinition[]` | Array of field definitions. |
| `definition.metadata` | `NormalizedMetadata?` | Optional metadata. |

**Returns:** `GlobalFieldDefinition`

### `defineModels(registry)`

Collects all your content type and global field definitions into a single model registry. Typically used in your `src/models/index.ts` barrel file.

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

// Option 1: Separate arrays for content types and global fields
export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});

// Option 2: Mixed array using the `definitions` property
export default defineModels({
  definitions: [seo, author, blogPost],
});

// Option 3: Combine both approaches
export default defineModels({
  definitions: [seo],
  contentTypes: [author, blogPost],
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `registry.contentTypes` | `ContentTypeDefinition[]?` | Array of content type definitions. |
| `registry.globalFields` | `GlobalFieldDefinition[]?` | Array of global field definitions. |
| `registry.definitions` | `ModelDefinition[]?` | Mixed array of content types and global fields. |

When all three arrays are provided, they are flattened in this order: `definitions`, then `globalFields`, then `contentTypes`. The order within each array is preserved for compilation.

**Returns:** `ModelRegistry`

### `defineModelsConfig(config)`

Defines the project configuration. Used in your `contentstack.stacksmith.config.ts` file.

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-website",
  modelsEntry: "./src/models/index.ts",
  outDir: "./.contentstack/models",
  strict: true,
  region: "EU",
  branch: "development",
});
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `projectName` | `string` | **(required)** | Identifier for the project. Used in manifest metadata. |
| `modelsEntry` | `string?` | `"./src/models/index.ts"` | Path to the models barrel file (relative to config file). |
| `outDir` | `string?` | `"./.contentstack/models"` | Directory where `schema.json` and `manifest.json` are written. |
| `strict` | `boolean?` | `true` | Enable strict schema validation during build. |
| `region` | `string?` | — | Contentstack region override (e.g., `"EU"`, `"AZURE-NA"`). |
| `branch` | `string?` | — | Contentstack branch override. |
| `defaults` | `Record<string, unknown>?` | — | Arbitrary default values for custom use. |

**Returns:** `ModelsConfig` with defaults applied.

---

## Field builders

Field builders are functions that create field definitions for use inside content types and global fields. Each builder function returns a typed `FieldDefinition` object.

All field builders auto-generate a `title` from the `uid` if you don't provide one. The conversion splits on underscores and capitalizes each word:

- `meta_title` → `"Meta Title"`
- `blog_post` → `"Blog Post"`
- `name` → `"Name"`

### `text(uid, options?)`

Creates a text field for storing strings. Supports multiline, regex format validation, and custom error messages.

```typescript
import { text } from "@timbenniks/contentstack-stacksmith";

text("title")
// { kind: "text", uid: "title", title: "Title", required: false, unique: false, multiple: false }

text("slug", { required: true, unique: true, description: "URL-friendly identifier" })

text("bio", { multiline: true, format: "^[a-zA-Z ]+$", formatErrorMessage: "Letters and spaces only" })
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `multiline` | `boolean?` | Enable multi-line text input. |
| `format` | `string?` | Regex pattern for validation. |
| `formatErrorMessage` | `string?` | Error message shown when format validation fails. |
| `defaultValue` | `string?` | Default string value. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `number(uid, options?)`

Numeric field.

```typescript
import { number } from "@timbenniks/contentstack-stacksmith";

number("price")
number("sort_order", { required: true, defaultValue: 0 })
```

### `boolean(uid, options?)`

Boolean toggle field.

```typescript
import { boolean } from "@timbenniks/contentstack-stacksmith";

boolean("is_featured")
boolean("published", { defaultValue: false })
```

### `date(uid, options?)`

Date/datetime field. Maps to CMA `data_type: "isodate"`. Supports date range constraints.

```typescript
import { date } from "@timbenniks/contentstack-stacksmith";

date("publish_date")
date("event_date", { required: true, startDate: "2024-01-01", endDate: "2025-12-31" })
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `startDate` | `string \| null?` | Earliest allowed date (ISO format). |
| `endDate` | `string \| null?` | Latest allowed date (ISO format). |
| `defaultValue` | `string?` | Default date value (ISO format). |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `json(uid, options?)`

JSON field for storing arbitrary structured data.

```typescript
import { json } from "@timbenniks/contentstack-stacksmith";

json("raw_data")
json("configuration", { description: "Custom JSON configuration object" })
```

### `file(uid, options?)`

File/asset picker field. Maps to CMA `data_type: "file"`.

```typescript
import { file } from "@timbenniks/contentstack-stacksmith";

file("hero_image")
file("document", { required: true, description: "Upload a PDF document" })

// Restrict to specific file extensions
file("attachment", {
  extensions: ["pdf", "docx", "png", "jpg"],
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `extensions` | `string[]?` | File extension allowlist (without the leading dot). Maps to CMA `extensions`. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `link(uid, options?)`

Link field with title and URL. Maps to CMA `data_type: "link"`.

```typescript
import { link } from "@timbenniks/contentstack-stacksmith";

link("external_url")
link("call_to_action", { required: true })
```

### `markdown(uid, options?)`

Markdown text field. Maps to CMA `data_type: "text"` with `field_metadata.markdown: true`.

```typescript
import { markdown } from "@timbenniks/contentstack-stacksmith";

markdown("body")
```

### `richText(uid, options?)`

HTML rich text editor field. Maps to CMA `data_type: "text"` with `field_metadata.allow_rich_text: true`.

```typescript
import { richText } from "@timbenniks/contentstack-stacksmith";

richText("content")
richText("summary", { richTextType: "basic" })
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `richTextType` | `string?` | Editor feature set. Defaults to `"advanced"` and preserves custom CMA values such as `"custom"`. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `jsonRte(uid, options?)`

JSON rich text editor field. Supports embedded entries via `referenceTo` and extension plugins via `plugins`. Maps to CMA `data_type: "json"` with `field_metadata.allow_json_rte: true`.

```typescript
import { jsonRte } from "@timbenniks/contentstack-stacksmith";

jsonRte("body")

jsonRte("content", {
  richTextType: "advanced",
  referenceTo: ["blog_post", "page"],
  description: "Rich content with embedded entries",
})

// With RTE extension plugins
jsonRte("body", {
  referenceTo: ["blog_post"],
  plugins: ["blt58a13863db325d6b"],
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `richTextType` | `string?` | Editor feature set. Defaults to `"advanced"` and preserves custom CMA values such as `"custom"`. |
| `referenceTo` | `string[]?` | Content type UIDs allowed for embedded entries. |
| `plugins` | `string[]?` | Extension UIDs for JSON RTE plugins. Maps to CMA `plugins`. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `reference(uid, options)`

Reference field that links to entries of one or more content types. Automatically creates a dependency from the current entity to each referenced content type.

```typescript
import { reference } from "@timbenniks/contentstack-stacksmith";

// Single content type reference
reference("author", { to: ["author"] })

// Multiple content type reference
reference("related_content", {
  to: ["blog_post", "news_article", "video"],
  multiple: true,
  description: "Related content from any type",
})

// Preserve the CMA's explicit multi-content-type flag (survives import roundtrip)
reference("items", {
  to: ["blog_post", "page"],
  multiple: true,
  refMultipleContentTypes: true,
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `to` | `string[]` | **(required)** Array of content type UIDs that this field can reference. |
| `refMultipleContentTypes` | `boolean?` | Maps to CMA `field_metadata.ref_multiple_content_types`. Set when you need to preserve the stack's explicit multi-content-type flag (e.g., for a clean import roundtrip). |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

Referenced content types must exist in your schema. If a reference points to a content type that isn't defined, the schema validation produces a `MISSING_REFERENCE_TARGET` blocker finding.

### `globalField(uid, options)`

Embeds a global field into a content type. Automatically creates a dependency from the current entity to the referenced global field.

```typescript
import { globalField } from "@timbenniks/contentstack-stacksmith";

globalField("seo", { ref: "seo" })

globalField("address", {
  ref: "address_block",
  description: "Shipping address using the shared address global field",
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `ref` | `string` | **(required)** UID of the global field to embed. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

The referenced global field must exist in your schema. If it doesn't, the schema validation produces a `MISSING_GLOBAL_FIELD` blocker finding.

### `enumField(uid, options)`

Dropdown/select field with predefined choices. Requires at least one choice. Supports two modes:

- **Plain** — `choices: string[]`. The string is both the stored value and the display label.
- **Advanced** — `choices: Array<{ key: string; value: string }>` with `advanced: true`. `key` is the display label shown to editors; `value` is the stored value written to entries. Maps to CMA `enum.advanced: true`.

```typescript
import { enumField } from "@timbenniks/contentstack-stacksmith";

// Plain
enumField("status", {
  choices: ["draft", "in_review", "published", "archived"],
  required: true,
  defaultValue: "draft",
  displayType: "dropdown",
})

// Advanced key/value mode
enumField("country", {
  advanced: true,
  choices: [
    { key: "United States", value: "US" },
    { key: "United Kingdom", value: "UK" },
    { key: "Netherlands", value: "NL" },
  ],
  displayType: "dropdown",
  multiple: true,
  minInstance: 1,
  maxInstance: 3,
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `choices` | `string[] \| EnumChoiceAdvanced[]` | **(required)** Array of allowed values. Use plain strings or `{ key, value }` pairs with `advanced: true`. |
| `advanced` | `boolean?` | Enable advanced key/value mode. When `true`, `choices` must be `{ key, value }` pairs. |
| `displayType` | `"dropdown" \| "radio"?` | UI widget type for the select field. |
| `minInstance` | `number?` | Minimum number of selections (requires `multiple: true`). Maps to CMA `min_instance`. |
| `maxInstance` | `number?` | Maximum number of selections (requires `multiple: true`). Maps to CMA `max_instance`. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `group(uid, options)`

Group field that nests other fields inside it.

```typescript
import { group, text, number } from "@timbenniks/contentstack-stacksmith";

group("dimensions", {
  fields: [
    number("width", { required: true }),
    number("height", { required: true }),
    text("unit", { defaultValue: "px" }),
  ],
  description: "Physical dimensions of the item",
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `fields` | `FieldDefinition[]` | **(required)** Array of nested field definitions. You can use any field builder inside a group, including other groups. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

### `modularBlocks(uid, options)`

Flexible content area where editors can add, remove, and reorder blocks of different types.

Each block is one of two shapes:

- **Inline block** — `{ uid, title, fields }` with its own schema
- **Global-field-reference block** — `{ uid, title, globalFieldRef }` that reuses an existing global field's schema (maps to the CMA's `reference_to` on a block)

::: tip
`modularBlocks` is the only field builder that defaults `multiple` to `true`. All other builders default `multiple` to `false`.
:::

```typescript
import { modularBlocks, text, json } from "@timbenniks/contentstack-stacksmith";

modularBlocks("page_content", {
  blocks: [
    // Inline block
    {
      uid: "hero_block",
      title: "Hero",
      fields: [
        text("heading", { required: true }),
        text("subheading"),
      ],
    },
    // Inline block
    {
      uid: "text_block",
      title: "Rich Text",
      fields: [
        json("body", { required: true }),
      ],
    },
    // Global-field-reference block — reuses the `cta` global field as a block
    {
      uid: "cta_banner",
      title: "CTA Banner",
      globalFieldRef: "cta",
    },
  ],
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `blocks` | `ModularBlockDefinition[]` | **(required)** Array of block definitions. Each block is either `{ uid, title, fields }` (inline) or `{ uid, title, globalFieldRef }` (global-field reference). The two shapes are mutually exclusive per block. |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). Note: `multiple` defaults to `true`. |

If a modular blocks field has no blocks (empty array), the schema validation produces an `EMPTY_MODULAR_BLOCKS` medium-level finding.

Fields inside inline blocks can include reference fields and global field fields, which create dependencies just like top-level fields do. Global-field-reference blocks create a `modular_block_reference` dependency in the normalized schema.

### `taxonomy(uid, options)`

Taxonomy term picker. Maps to CMA `data_type: "taxonomy"`.

```typescript
import { taxonomy } from "@timbenniks/contentstack-stacksmith";

taxonomy("categories", {
  taxonomies: [
    { taxonomy_uid: "product_categories", max_terms: 5 },
    { taxonomy_uid: "regions", max_terms: 3, mandatory: true, non_localizable: true },
  ],
})
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `taxonomies` | `TaxonomyRef[]` | **(required)** Array of taxonomy references. Each has `taxonomy_uid` (string), optional `max_terms` (number), optional `mandatory` (boolean), optional `multiple` (boolean), and optional `non_localizable` (boolean). |
| `*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). Note: `multiple` defaults to `true`. |

---

## Common field options

Every field builder accepts these options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string?` | Auto-generated from `uid` | Human-readable display name. If omitted, generated by splitting the UID on underscores and capitalizing each word (`meta_title` → `"Meta Title"`). |
| `required` | `boolean?` | `false` | Whether the field must have a value. |
| `unique` | `boolean?` | `false` | Whether the field value must be unique across all entries. |
| `multiple` | `boolean?` | `false` (`true` for `modularBlocks` and `taxonomy`) | Whether the field accepts multiple values (array). |
| `nonLocalizable` | `boolean?` | — | Whether the field is excluded from localization. Maps to CMA `non_localizable`. |
| `description` | `string?` | — | Help text shown to editors in the Contentstack dashboard. |
| `defaultValue` | varies | — | Default value. Type-narrowed per field: `string` for text/date, `number` for number, `boolean` for boolean, `Record<string, unknown>` for json. |
| `errorMessages` | `Record<string, string>?` | — | Custom validation error messages keyed by error kind (e.g., `{ format: "Invalid slug." }`). |
| `metadata` | `Record<string, unknown>?` | — | Custom metadata attached to the field. |
| `previousUid` | `string?` | — | The previous UID of this field. When set, the diff engine emits a single `rename_field` operation instead of a remove + add (which would lose entry data on populated content types). See [Renaming fields](#renaming-fields). |

::: info UID validation
All UIDs (fields and entities) must match `^[a-z][a-z0-9_]*$` — start with a lowercase letter, contain only lowercase letters, numbers, and underscores. Invalid UIDs throw immediately at authoring time.
:::

### Renaming fields

To rename a field without losing the data stored on existing entries, add `previousUid` pointing at the old UID:

```ts
import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export const author = defineContentType("author", {
  title: "Author",
  fields: [
    text("title", { required: true }),
    // Was previously named `full_name`. On the next apply/promote, the
    // diff engine emits a single rename_field op instead of remove+add:
    text("display_name", { previousUid: "full_name" }),
  ],
});
```

Behavior:

- **Happy path**: the remote has `full_name` but not `display_name` → the diff emits one `rename_field` op (low-risk). After a successful apply, remove `previousUid` on your next edit; it's vestigial once the rename has landed.
- **Collision**: both `full_name` and `display_name` exist on the remote (usually from a botched prior apply) → the plan is **blocked** with a clear message. Remove one manually via the UI before re-running.
- **Vestigial**: the remote has neither the old nor new UID → the rename falls through to a normal `add_field` op, as if you'd just added the field fresh.

**Restrictions:**

- `previousUid` is only allowed on **top-level** fields of a content type or global field. Setting it on a field nested inside a `group()` or `modularBlocks()` throws at compile time — Contentstack's CMA does not support in-place renames of nested sub-fields.
- Content-type UIDs themselves are **not** renameable via this mechanism (CMA limitation). Only fields.
- `previousUid` equal to the field's own `uid` throws at compile time (nothing to rename).

---

## Content type options

`defineContentType(uid, { options: ... })` accepts a typed `ContentTypeOptions` object. All properties are optional and map directly to CMA content type options.

```typescript
defineContentType("page", {
  title: "Page",
  fields: [/* ... */],
  options: {
    title: "title",           // Field UID used as the entry title
    publishable: true,        // Entries can be published
    is_page: true,            // Page-type content type
    singleton: false,         // Multiple entries allowed
    sub_title: ["url"],       // Fields shown as subtitle
    url_pattern: "/:title",   // URL pattern template
    url_prefix: "/",          // URL prefix
  },
})
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string?` | Field UID used as entry title in the Contentstack dashboard. |
| `publishable` | `boolean?` | Whether entries of this content type can be published. |
| `is_page` | `boolean?` | Marks this as a page-type content type. |
| `singleton` | `boolean?` | Restricts the content type to a single entry. |
| `sub_title` | `string[]?` | Field UIDs shown as subtitle in the entry list. |
| `url_pattern` | `string?` | URL pattern template for entries. |
| `url_prefix` | `string?` | URL prefix prepended to entry URLs. |
| `[key: string]` | `unknown` | Any other CMA content type option is passed through verbatim. |

The typed interface is surfaced through `CompiledContentType.options` in the normalized schema, and the values round-trip end-to-end through import, diff, and apply.
