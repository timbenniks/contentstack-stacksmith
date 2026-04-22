# Field Mapping Reference

Complete mapping from Contentstack CMA schema fields to DSL builder calls.

---

## Data type mapping

| CMA `data_type` | DSL builder | DSL field kind |
|------------------|-------------|----------------|
| `text` | `text()` | `text` |
| `number` | `number()` | `number` |
| `boolean` | `boolean()` | `boolean` |
| `isodate` | `date()` | `date` |
| `json` | `json()` | `json` |
| `reference` | `reference()` | `reference` |
| `global_field` | `globalField()` | `global_field` |
| `group` | `group()` | `group` |
| `blocks` | `modularBlocks()` | `modular_blocks` |
| `file` | `file()` | `file` |
| `link` | `link()` | `link` |

### Fields without a DSL equivalent

If a source field type has no faithful DSL equivalent, fall back to the nearest safe builder and add a code comment explaining the original Contentstack type so parity failures are easy to debug.

---

## Field option mapping

| CMA property | DSL option | Type | Notes |
|--------------|-----------|------|-------|
| `mandatory` | `required` | `boolean` | |
| `unique` | `unique` | `boolean` | |
| `multiple` | `multiple` | `boolean` | `modularBlocks` defaults to `true` |
| `non_localizable` | `nonLocalizable` | `boolean` | Excludes the field from localization |
| `display_name` | `title` | `string` | Only set explicitly if it differs from auto-generated title |
| `field_metadata.description` | `description` | `string` | |
| `default_value` | `defaultValue` | varies | |
| `error_messages` | `errorMessages` | `Record<string, string>` | Full pass-through. `error_messages.format` on text fields is emitted as `formatErrorMessage` instead |
| `field_metadata.ref_multiple_content_types` | `refMultipleContentTypes` | `boolean` | Reference fields only |
| `enum.advanced` + `choices[].key` | `advanced: true` + `choices: [{ key, value }]` | — | Enum fields only |
| `min_instance` / `max_instance` | `minInstance` / `maxInstance` | `number` | Enum fields only |
| `extensions` | `extensions` | `string[]` | File fields only |
| `plugins` | `plugins` | `string[]` | JSON RTE fields only |
| `taxonomies[].non_localizable` | `taxonomies[].non_localizable` | `boolean` | Taxonomy fields — per-taxonomy flag |

---

## Reference field mapping

CMA:
```json
{
  "uid": "author",
  "data_type": "reference",
  "display_name": "Author",
  "reference_to": ["author"],
  "mandatory": true,
  "multiple": false
}
```

DSL:
```ts
reference("author", { to: ["author"], required: true })
```

### Polymorphic references

CMA:
```json
{
  "uid": "related_content",
  "data_type": "reference",
  "reference_to": ["blog_post", "page", "product"],
  "multiple": true
}
```

DSL:
```ts
reference("related_content", { to: ["blog_post", "page", "product"], multiple: true })
```

---

## Global field mapping

CMA:
```json
{
  "uid": "seo",
  "data_type": "global_field",
  "display_name": "SEO",
  "reference_to": "seo"
}
```

DSL:
```ts
globalField("seo", { ref: "seo" })
```

Note: In CMA responses, global field references use `reference_to` as a string (not array). The DSL uses `ref`.

---

## Enum field mapping

CMA enums appear as text fields with an `enum` property:

CMA:
```json
{
  "uid": "status",
  "data_type": "text",
  "display_name": "Status",
  "enum": {
    "choices": [
      { "value": "draft" },
      { "value": "published" },
      { "value": "archived" }
    ]
  },
  "default_value": "draft"
}
```

DSL:
```ts
enumField("status", {
  choices: ["draft", "published", "archived"],
  defaultValue: "draft",
})
```

Note: CMA choices can be plain strings or objects with a `value` property. Always extract the string value.

### Advanced enums (key/value pairs)

When CMA has `enum.advanced: true`, each choice has both a `key` (display label) and a `value` (stored value). Preserve both.

CMA:
```json
{
  "uid": "country",
  "data_type": "text",
  "display_type": "dropdown",
  "enum": {
    "advanced": true,
    "choices": [
      { "key": "United States", "value": "US" },
      { "key": "United Kingdom", "value": "UK" }
    ]
  },
  "min_instance": 1,
  "max_instance": 3,
  "multiple": true
}
```

DSL:
```ts
enumField("country", {
  advanced: true,
  choices: [
    { key: "United States", value: "US" },
    { key: "United Kingdom", value: "UK" },
  ],
  displayType: "dropdown",
  minInstance: 1,
  maxInstance: 3,
  multiple: true,
})
```

---

## Group field mapping

CMA:
```json
{
  "uid": "address",
  "data_type": "group",
  "display_name": "Address",
  "schema": [
    { "uid": "street", "data_type": "text", "display_name": "Street" },
    { "uid": "city", "data_type": "text", "display_name": "City" },
    { "uid": "zip_code", "data_type": "text", "display_name": "Zip Code" }
  ]
}
```

DSL:
```ts
group("address", {
  fields: [
    text("street"),
    text("city"),
    text("zip_code"),
  ],
})
```

Recursively apply the same mapping rules to nested fields within the group.

---

## Modular blocks mapping

CMA:
```json
{
  "uid": "page_content",
  "data_type": "blocks",
  "display_name": "Page Content",
  "blocks": [
    {
      "uid": "hero",
      "title": "Hero",
      "schema": [
        { "uid": "heading", "data_type": "text", "mandatory": true },
        { "uid": "subheading", "data_type": "text" }
      ]
    },
    {
      "uid": "text_section",
      "title": "Text Section",
      "schema": [
        { "uid": "body", "data_type": "json", "mandatory": true }
      ]
    }
  ]
}
```

DSL:
```ts
modularBlocks("page_content", {
  blocks: [
    {
      uid: "hero",
      title: "Hero",
      fields: [
        text("heading", { required: true }),
        text("subheading"),
      ],
    },
    {
      uid: "text_section",
      title: "Text Section",
      fields: [
        json("body", { required: true }),
      ],
    },
  ],
})
```

Note: CMA uses `schema` for nested fields, DSL uses `fields`. CMA uses `mandatory`, DSL uses `required`.

### Blocks that reference a global field

Modular blocks can also reference a global field directly. On the CMA, the block omits `schema` and uses `reference_to: "<global_field_uid>"`. On the DSL side, the block entry uses `globalFieldRef` instead of `fields`.

CMA:
```json
{
  "uid": "page_content",
  "data_type": "blocks",
  "blocks": [
    { "uid": "hero", "title": "Hero", "schema": [{ "uid": "heading", "data_type": "text" }] },
    { "uid": "cta_banner", "title": "CTA Banner", "reference_to": "cta" }
  ]
}
```

DSL:
```ts
modularBlocks("page_content", {
  blocks: [
    { uid: "hero", title: "Hero", fields: [text("heading")] },
    { uid: "cta_banner", title: "CTA Banner", globalFieldRef: "cta" },
  ],
})
```

Each block uses one shape OR the other — never both.

---

## Complete example

### CMA content type response

```json
{
  "content_type": {
    "uid": "blog_post",
    "title": "Blog Post",
    "description": "A blog article",
    "schema": [
      { "uid": "title", "data_type": "text", "display_name": "Title", "mandatory": true, "unique": false },
      { "uid": "slug", "data_type": "text", "display_name": "Slug", "mandatory": true, "unique": true },
      { "uid": "body", "data_type": "json", "display_name": "Body", "mandatory": true },
      { "uid": "author", "data_type": "reference", "display_name": "Author", "reference_to": ["author"], "mandatory": true },
      { "uid": "seo", "data_type": "global_field", "display_name": "SEO", "reference_to": "seo" }
    ],
    "options": { "singleton": false }
  }
}
```

### Generated DSL code

```ts
import { defineContentType, text, json, reference, globalField } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  description: "A blog article",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    json("body", { required: true }),
    reference("author", { to: ["author"], required: true }),
    globalField("seo", { ref: "seo" }),
  ],
  options: {
    singleton: false,
  },
});
```
