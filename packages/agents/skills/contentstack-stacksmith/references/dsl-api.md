# DSL API Reference

Complete API reference for `@timbenniks/contentstack-stacksmith`.

## Imports

```ts
import {
  // Entity helpers
  defineContentType,
  defineGlobalField,
  defineModels,
  defineModelsConfig,

  // Field builders
  text,
  number,
  boolean,
  date,
  json,
  file,
  link,
  markdown,
  richText,
  jsonRte,
  reference,
  enumField,
  group,
  modularBlocks,
  globalField,
  taxonomy,
} from "@timbenniks/contentstack-stacksmith";
```

---

## Entity helpers

### `defineContentType(uid, definition)`

Defines a content type.

```ts
export default defineContentType("blog_post", {
  title: "Blog Post",
  description: "A blog article with author and SEO.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
  options: {
    singleton: false,
  },
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | `string` | yes | Unique identifier, `snake_case` |
| `definition.title` | `string` | no | Display title (auto-generated from uid if omitted) |
| `definition.description` | `string` | no | Description text |
| `definition.fields` | `FieldDefinition[]` | yes | Array of field definitions |
| `definition.options.singleton` | `boolean` | no | Whether only one entry can exist (default: `false`) |

### `defineGlobalField(uid, definition)`

Defines a reusable global field group.

```ts
export default defineGlobalField("seo", {
  title: "SEO",
  description: "Shared SEO metadata fields.",
  fields: [
    text("meta_title"),
    text("meta_description"),
    text("og_image"),
  ],
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | `string` | yes | Unique identifier, `snake_case` |
| `definition.title` | `string` | no | Display title |
| `definition.description` | `string` | no | Description text |
| `definition.fields` | `FieldDefinition[]` | yes | Array of field definitions |

### `defineModels(registry)`

Registers all content types and global fields. Used in the models entry file.

```ts
import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `registry.contentTypes` | `ContentTypeDefinition[]` | yes | Array of content type definitions |
| `registry.globalFields` | `GlobalFieldDefinition[]` | yes | Array of global field definitions |

### `defineModelsConfig(config)`

Defines the project configuration. Used in `contentstack.stacksmith.config.ts`.

```ts
export default defineModelsConfig({
  projectName: "my-project",
  modelsEntry: "./src/models/index.ts",
  outDir: "./.contentstack/models",
  strict: true,
});
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config.projectName` | `string` | — | Project name |
| `config.modelsEntry` | `string` | `"./src/models/index.ts"` | Path to models entry file |
| `config.outDir` | `string` | `"./.contentstack/models"` | Output directory for build artifacts |
| `config.strict` | `boolean` | `true` | Enable strict validation |

---

## Field builders

All field builders share a common options interface.

### Common field options

Every field builder accepts these options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | auto from uid | Display title |
| `required` | `boolean` | `false` | Whether the field is mandatory |
| `unique` | `boolean` | `false` | Whether values must be unique across entries |
| `multiple` | `boolean` | `false` | Whether the field accepts multiple values |
| `nonLocalizable` | `boolean` | `false` | Exclude this field from localization (maps to CMA `non_localizable`) |
| `description` | `string` | — | Help text shown to editors |
| `defaultValue` | varies | — | Default value for the field |
| `errorMessages` | `Record<string, string>` | — | Custom validation error messages keyed by error kind |
| `metadata` | `Record<string, unknown>` | — | Custom metadata key-value pairs |

### `text(uid, options?)`

Text field for strings.

```ts
text("title")
text("title", { required: true })
text("slug", { required: true, unique: true })
text("subtitle", { description: "Optional subtitle" })
```

### `number(uid, options?)`

Numeric field.

```ts
number("price")
number("sort_order", { required: true, defaultValue: 0 })
```

### `boolean(uid, options?)`

Boolean toggle field.

```ts
boolean("is_featured")
boolean("is_published", { defaultValue: false })
```

### `date(uid, options?)`

Date/datetime field.

```ts
date("publish_date")
date("created_at", { required: true })
```

### `json(uid, options?)`

Rich text or raw JSON field.

```ts
json("body")
json("configuration", { description: "Raw JSON config" })
```

### `reference(uid, options)`

Reference to one or more content types. The `to` option is required.

```ts
// Single content type reference
reference("author", { to: ["author"] })

// Multiple content type reference
reference("related_content", { to: ["blog_post", "page"], multiple: true })

// Required reference
reference("category", { to: ["category"], required: true })

// Multi-type reference with the CMA flag set explicitly
reference("items", {
  to: ["blog_post", "page"],
  multiple: true,
  refMultipleContentTypes: true,
})
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `to` | `string[]` | yes | Array of content type UIDs this field can reference |
| `refMultipleContentTypes` | `boolean` | no | Maps to CMA `field_metadata.ref_multiple_content_types`. Set when you want to preserve the stack's explicit multi-content-type flag. |

### `globalField(uid, options)`

Embeds a global field. The `ref` option is required.

```ts
globalField("seo", { ref: "seo" })
globalField("hero_banner", { ref: "hero" })
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `ref` | `string` | yes | UID of the global field to embed |

### `enumField(uid, options)`

Dropdown / select field with predefined choices. The `choices` option is required. Supports two modes:

- **Plain**: `choices: string[]` — the string is both the stored value and display label.
- **Advanced**: `choices: Array<{ key: string; value: string }>` with `advanced: true` — `key` is the display label, `value` is the stored value.

```ts
// Plain
enumField("status", {
  choices: ["draft", "published", "archived"],
  defaultValue: "draft",
})

// Advanced (key/value pairs)
enumField("country", {
  advanced: true,
  choices: [
    { key: "United States", value: "US" },
    { key: "United Kingdom", value: "UK" },
  ],
  displayType: "dropdown",
  minInstance: 1,
  maxInstance: 3,
})
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `choices` | `string[]` \| `Array<{ key: string; value: string }>` | yes | List of allowed values; use `{ key, value }` pairs with `advanced: true` |
| `advanced` | `boolean` | no | Enable advanced key/value mode (maps to CMA `enum.advanced: true`) |
| `displayType` | `"dropdown"` \| `"radio"` | no | UI widget type |
| `minInstance` | `number` | no | Minimum number of selections (requires `multiple: true`) |
| `maxInstance` | `number` | no | Maximum number of selections (requires `multiple: true`) |

### `group(uid, options)`

Groups related fields together. The `fields` option is required.

```ts
group("cta", {
  fields: [
    text("label", { required: true }),
    text("url", { required: true }),
  ],
})

// Nested groups
group("address", {
  fields: [
    text("street"),
    text("city"),
    text("state"),
    text("zip_code"),
    group("coordinates", {
      fields: [
        number("latitude"),
        number("longitude"),
      ],
    }),
  ],
})
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `fields` | `FieldDefinition[]` | yes | Array of field definitions within the group |

### `modularBlocks(uid, options)`

Flexible content area composed of reusable blocks. The `blocks` option is required. Defaults `multiple` to `true`.

Each block is either:

- **Inline** — `{ uid, title, fields }` with its own schema.
- **Global field reference** — `{ uid, title, globalFieldRef }` pointing at a global field UID. The block reuses the referenced global field's schema in place.

```ts
modularBlocks("page_content", {
  blocks: [
    // Inline block
    {
      uid: "hero",
      title: "Hero",
      fields: [
        text("heading", { required: true }),
        text("subheading"),
      ],
    },
    // Inline block
    {
      uid: "text_section",
      title: "Text Section",
      fields: [
        text("heading"),
        json("body", { required: true }),
      ],
    },
    // Global-field-reference block — reuses the global field `cta` as a block
    {
      uid: "cta_banner",
      title: "CTA Banner",
      globalFieldRef: "cta",
    },
  ],
})
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `blocks` | `ModularBlockDefinition[]` | yes | Array of block definitions |

**Block definition** (union of two shapes):

Inline block:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `uid` | `string` | yes | Block identifier, `snake_case` |
| `title` | `string` | yes | Display title for the block |
| `fields` | `FieldDefinition[]` | yes | Inline fields within the block |

Global-field-reference block:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `uid` | `string` | yes | Block identifier, `snake_case` |
| `title` | `string` | yes | Display title for the block |
| `globalFieldRef` | `string` | yes | UID of an existing `defineGlobalField(...)` — the block reuses that global field's schema |

### `file(uid, options?)`

File / asset picker field with optional allowlist of extensions.

```ts
file("hero_image")
file("attachment", { extensions: ["pdf", "docx"] })
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `extensions` | `string[]` | no | File extension allowlist (maps to CMA `extensions` on file fields) |

### `jsonRte(uid, options?)`

JSON Rich Text Editor. Supports embedded entry references via `referenceTo` and extension plugins via `plugins`.

```ts
jsonRte("body", {
  richTextType: "advanced",
  referenceTo: ["blog_post"],
  plugins: ["blt58a13863db325d6b"],
})
```

**Specific options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `richTextType` | `"basic" \| "advanced"` | no | Editor mode (default: `"advanced"`) |
| `referenceTo` | `string[]` | no | Content type UIDs allowed as embedded entries |
| `plugins` | `string[]` | no | Extension UIDs for JSON RTE plugins (maps to CMA `plugins`) |

### `taxonomy(uid, options)`

Taxonomy term picker.

```ts
taxonomy("topics", {
  taxonomies: [
    { taxonomy_uid: "topic", max_terms: 5, mandatory: true, non_localizable: false },
  ],
})
```

Each `taxonomies[]` entry accepts `taxonomy_uid`, `max_terms`, `mandatory`, and `non_localizable`.

---

## Important rules

- UIDs must be `snake_case`.
- `reference(..., { to: [...] })` targets content type UIDs — make sure they exist in the registry.
- `globalField(..., { ref: ... })` targets global field UIDs — make sure they exist in the registry.
- `modularBlocks(...)` defaults `multiple` to `true`.
- Modular block entries can either declare inline `fields` OR reference a global field via `globalFieldRef` — never both.
- `enumField(...)` advanced mode requires a `key` on every choice; plain mode uses bare strings.
- Titles are auto-generated from UIDs if not provided (e.g., `"blog_post"` becomes `"Blog Post"`).
- The supported field kinds are: `text`, `number`, `boolean`, `date`, `json`, `file`, `link`, `markdown`, `rich_text`, `json_rte`, `reference`, `enum`, `group`, `modular_blocks`, `global_field`, and `taxonomy`.
- Dependencies between entities are tracked automatically by the compiler. Reference and global field usage creates dependency edges.
