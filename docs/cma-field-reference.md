# Contentstack CMA Field Type Reference

> Authoritative reference for how Contentstack Content Management API represents field types.
> Sources: `cma-openapi-3.json`, official docs, `contentstack-audit` CLI, `contentstack-import` CLI, `json-rte-serializer`.
> Last verified: 2026-04-16.

---

## Table of Contents

- [Common Field Properties](#common-field-properties)
- [Field Types by data_type](#field-types-by-data_type)
  - [text](#text)
  - [number](#number)
  - [boolean](#boolean)
  - [isodate](#isodate)
  - [file](#file)
  - [link](#link)
  - [reference](#reference)
  - [global_field](#global_field)
  - [group](#group)
  - [blocks (modular blocks)](#blocks-modular-blocks)
  - [json](#json)
  - [taxonomy](#taxonomy)
- [Text Variants (same data_type, different field_metadata)](#text-variants)
- [JSON Variants (same data_type, different field_metadata)](#json-variants)
- [Select/Enum Fields](#selectenum-fields)
- [Field Constraints](#field-constraints)
- [Content Type Options](#content-type-options)
- [DSL-to-CMA Mapping Table](#dsl-to-cma-mapping-table)
- [Audit CLI Type Definitions](#audit-cli-type-definitions)
- [Import CLI Behaviors](#import-cli-behaviors)

---

## Common Field Properties

Every field in a content type schema shares these properties:

```json
{
  "data_type": "text",
  "display_name": "Field Label",
  "uid": "field_uid",
  "mandatory": false,
  "unique": false,
  "multiple": false,
  "non_localizable": false,
  "field_metadata": {
    "description": "",
    "default_value": ""
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `data_type` | string | The CMA field type identifier |
| `display_name` | string | User-facing label |
| `uid` | string | Machine name (unique within entity) |
| `mandatory` | boolean | Whether field is required |
| `unique` | boolean | Whether values must be unique |
| `multiple` | boolean | Whether field accepts an array of values |
| `non_localizable` | boolean | Whether field is excluded from localization |
| `field_metadata` | object | Type-specific metadata and config |

---

## Field Types by data_type

### text

Single-line or multi-line text input.

```json
{
  "data_type": "text",
  "display_name": "Single line textbox",
  "uid": "single_line",
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "format": "",
  "error_messages": {
    "format": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

Multi-line variant adds `"multiline": true` to `field_metadata`:

```json
{
  "data_type": "text",
  "display_name": "Multi line textbox",
  "uid": "multi_line",
  "field_metadata": {
    "description": "",
    "default_value": "",
    "multiline": true
  },
  "format": "",
  "error_messages": {
    "format": ""
  }
}
```

See also: [Text Variants](#text-variants) for markdown and rich text.

### number

Numeric field.

```json
{
  "data_type": "number",
  "display_name": "Number",
  "uid": "number",
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Note:** The CMA docs do not define explicit `min`/`max` constraint properties for number fields. Only `mandatory`, `unique`, and `multiple` are documented.

### boolean

Boolean toggle.

```json
{
  "data_type": "boolean",
  "display_name": "Boolean",
  "uid": "boolean",
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

### isodate

Date/time picker. The CMA uses `"isodate"` (not `"date"`).

```json
{
  "data_type": "isodate",
  "display_name": "Date",
  "uid": "date",
  "startDate": null,
  "endDate": null,
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `startDate` | string or null | Earliest allowed date |
| `endDate` | string or null | Latest allowed date |

### file

File/asset picker.

```json
{
  "data_type": "file",
  "display_name": "File",
  "uid": "file",
  "extensions": [],
  "field_metadata": {
    "description": "",
    "rich_text_type": "standard"
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Note:** The import CLI detects asset values in entries by checking `_.has(object, 'filename') && _.has(object, 'uid')`. Asset references use `_content_type_uid: 'sys_assets'`.

### link

URL/link field with title and href.

```json
{
  "data_type": "link",
  "display_name": "Link",
  "uid": "link",
  "field_metadata": {
    "description": "",
    "default_value": {
      "title": "",
      "url": ""
    }
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

Entry value shape:

```json
{
  "title": "Click here",
  "href": "https://example.com"
}
```

### reference

Reference to other content type entries.

```json
{
  "data_type": "reference",
  "display_name": "Reference",
  "uid": "author",
  "reference_to": ["author"],
  "field_metadata": {
    "ref_multiple": false,
    "ref_multiple_content_types": true
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `reference_to` | string[] | Array of content type UIDs that can be referenced |
| `field_metadata.ref_multiple_content_types` | boolean | Whether multiple content types are allowed |

Entry value shape:

```json
[{ "uid": "entry_uid", "_content_type_uid": "content_type_uid" }]
```

**Import CLI note:** Old single-reference format (`reference_to: "string"`) is auto-converted to array format with `ref_multiple_content_types: true`.

### global_field

Embeds a reusable global field schema.

```json
{
  "data_type": "global_field",
  "display_name": "SEO",
  "uid": "seo",
  "reference_to": "seo_global_field_uid",
  "schema": [
    { "...nested fields..." }
  ],
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `reference_to` | string | Single global field UID (NOT an array) |
| `schema` | array | The resolved nested field schema |

### group

Container for nested fields.

```json
{
  "data_type": "group",
  "display_name": "Details",
  "uid": "details",
  "schema": [
    {
      "data_type": "text",
      "display_name": "Name",
      "uid": "name",
      "mandatory": false,
      "unique": false,
      "multiple": false
    }
  ],
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `schema` | array | Nested field definitions (recursive) |
| `multiple` | boolean | When true, allows repeating groups (array of objects) |

### blocks (modular blocks)

Polymorphic block array. Each block has its own schema.

```json
{
  "data_type": "blocks",
  "display_name": "Page Sections",
  "uid": "sections",
  "blocks": [
    {
      "uid": "hero",
      "title": "Hero Section",
      "schema": [
        {
          "data_type": "text",
          "display_name": "Headline",
          "uid": "headline",
          "mandatory": true,
          "unique": false,
          "multiple": false
        }
      ]
    },
    {
      "uid": "cta",
      "title": "Call to Action",
      "schema": [
        {
          "data_type": "text",
          "display_name": "Button Text",
          "uid": "button_text",
          "mandatory": false,
          "unique": false,
          "multiple": false
        }
      ]
    }
  ],
  "mandatory": false,
  "unique": false,
  "multiple": true
}
```

### json

Generic JSON field. Also used as the base `data_type` for JSON RTE and custom extensions (distinguished by `field_metadata` flags).

```json
{
  "data_type": "json",
  "display_name": "Custom Data",
  "uid": "custom_data",
  "field_metadata": {
    "description": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

See also: [JSON Variants](#json-variants) for JSON RTE and custom fields.

### taxonomy

Taxonomy term picker.

```json
{
  "data_type": "taxonomy",
  "display_name": "Taxonomy",
  "uid": "taxonomies",
  "taxonomies": [
    {
      "taxonomy_uid": "sample_one",
      "max_terms": 5,
      "mandatory": true,
      "non_localizable": false
    },
    {
      "taxonomy_uid": "sample_two",
      "max_terms": 10,
      "mandatory": true,
      "non_localizable": false
    }
  ],
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "format": "",
  "error_messages": {
    "format": ""
  },
  "mandatory": false,
  "multiple": true,
  "unique": false
}
```

| Property | Type | Description |
|----------|------|-------------|
| `taxonomies` | array | List of taxonomy references |
| `taxonomies[].taxonomy_uid` | string | UID of the taxonomy |
| `taxonomies[].max_terms` | number | Maximum number of terms allowed |
| `taxonomies[].mandatory` | boolean | Whether at least one term is required |

Entry value shape:

```json
[
  { "taxonomy_uid": "sample_one", "term_uid": "data_science" }
]
```

---

## Text Variants

The `data_type: "text"` is overloaded. The actual field type is determined by `field_metadata` flags:

### Plain Text

No special flags. See [text](#text) above.

### Markdown

```json
{
  "data_type": "text",
  "display_name": "Markdown",
  "uid": "markdown",
  "field_metadata": {
    "markdown": true,
    "description": ""
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Distinguishing flag:** `field_metadata.markdown === true`

### HTML Rich Text Editor (Legacy RTE)

```json
{
  "data_type": "text",
  "display_name": "HTML Rich text editor",
  "uid": "html_rte",
  "field_metadata": {
    "allow_rich_text": true,
    "description": "",
    "multiline": false,
    "rich_text_type": "advanced",
    "version": 3
  },
  "reference_to": ["content_type_UID_1", "sys_assets"],
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Distinguishing flag:** `field_metadata.allow_rich_text === true`

| Property | Type | Description |
|----------|------|-------------|
| `field_metadata.rich_text_type` | `string` | Editor feature set, including custom modes such as `"custom"` |
| `reference_to` | string[] | Content types allowed for embedded entries/assets |
| `field_metadata.version` | number | Schema version |

### Detection Priority (for `data_type: "text"`)

1. `field_metadata.allow_rich_text === true` -> HTML Rich Text
2. `field_metadata.markdown === true` -> Markdown
3. Has `display_type` + `enum` properties -> Select/Enum (see below)
4. Otherwise -> Plain text

---

## JSON Variants

The `data_type: "json"` is overloaded. The actual field type is determined by `field_metadata` flags:

### Plain JSON

No special flags. See [json](#json) above.

### JSON Rich Text Editor (JSON RTE)

```json
{
  "data_type": "json",
  "display_name": "JSON RTE",
  "uid": "json_rte",
  "field_metadata": {
    "allow_json_rte": true,
    "rich_text_type": "advanced",
    "embed_entry": false,
    "description": "",
    "default_value": "",
    "multiline": false,
    "options": []
  },
  "reference_to": ["blog_posts", "sys_assets"],
  "plugins": ["blt58a13863db325d6b"],
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Distinguishing flag:** `field_metadata.allow_json_rte === true`

| Property | Type | Description |
|----------|------|-------------|
| `field_metadata.rich_text_type` | `string` | Editor feature set, including custom modes such as `"custom"` |
| `field_metadata.embed_entry` | boolean | Whether embedded entries are enabled |
| `reference_to` | string[] | Content types allowed for embedded entries/assets |
| `plugins` | string[] | Extension UIDs for JSON RTE plugins |

#### JSON RTE Entry Value Structure

The entry value is a tree of typed nodes:

```json
{
  "uid": "node_uid",
  "type": "doc",
  "children": [
    {
      "type": "p",
      "children": [{ "text": "Hello world" }]
    },
    {
      "type": "reference",
      "attrs": {
        "type": "entry",
        "entry-uid": "bltf4838a625cd10cc2",
        "content-type-uid": "blog_posts",
        "locale": "en-us"
      },
      "children": [{ "text": "" }]
    }
  ]
}
```

**Node types** (from `json-rte-serializer`):
- Block: `blockquote`, `h1`-`h6`, `p`, `code`, `ol`, `ul`, `li`, `hr`, `table`, `thead`, `tbody`, `tr`, `td`, `th`, `img`, `embed`, `social-embeds`
- Inline: `span`, `a`, `inlineCode`, `reference`
- Layout: `row`, `column`, `grid-container`, `grid-child`, `check-list`
- Text formatting (boolean props): `bold`, `italic`, `underline`, `strikethrough`, `superscript`, `subscript`, `inlineCode`

**Asset reference attrs:**
```json
{
  "type": "asset",
  "asset-uid": "...",
  "asset-link": "...",
  "display-type": "display|link|inline|block",
  "content-type-uid": "sys_assets"
}
```

### Custom Extension Field

```json
{
  "data_type": "json",
  "display_name": "Extension",
  "uid": "custom_field",
  "extension_uid": "blt002c000ce00b00000",
  "config": { "key": "value" },
  "field_metadata": {
    "extension": true
  },
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Distinguishing flag:** `field_metadata.extension === true`

### Custom Asset Field (Extension-based)

```json
{
  "data_type": "json",
  "display_name": "Asset Field",
  "uid": "asset_field",
  "extension_uid": "bltbf4845ca37e6b6b9",
  "field_metadata": {
    "extension": true,
    "is_asset": true
  },
  "reference_to": ["sys_assets"],
  "config": {},
  "mandatory": false,
  "unique": false,
  "multiple": false
}
```

**Distinguishing flags:** `field_metadata.extension === true` AND `field_metadata.is_asset === true`

### Detection Priority (for `data_type: "json"`)

1. `field_metadata.allow_json_rte === true` -> JSON RTE
2. `field_metadata.extension === true` -> Custom Extension
3. Otherwise -> Plain JSON

---

## Select/Enum Fields

Select fields reuse `data_type: "text"` (or `"number"` for numeric selects) with `display_type` and `enum` properties.

### Text Select (Dropdown)

```json
{
  "data_type": "text",
  "display_name": "Select",
  "display_type": "dropdown",
  "enum": {
    "advanced": false,
    "choices": [
      { "value": "1" },
      { "value": "2" },
      { "value": "3" }
    ]
  },
  "multiple": true,
  "uid": "select_field",
  "field_metadata": {
    "description": "",
    "default_value": ""
  },
  "mandatory": false,
  "unique": false
}
```

### Advanced Select (Key-Value Pairs)

```json
{
  "data_type": "text",
  "display_name": "Select Advanced",
  "display_type": "dropdown",
  "enum": {
    "advanced": true,
    "choices": [
      { "key": "New York", "value": "NY" },
      { "key": "India", "value": "IN" }
    ]
  },
  "multiple": true,
  "uid": "select_advanced"
}
```

| Property | Type | Description |
|----------|------|-------------|
| `display_type` | `"dropdown" \| "radio"` | UI widget type |
| `enum.advanced` | boolean | Whether choices use key-value pairs |
| `enum.choices` | array | Available options |
| `enum.choices[].value` | string | The stored value |
| `enum.choices[].key` | string | Display label (only when `advanced: true`) |

**Audit CLI type:** `SelectFeildStruct` (note: typo "Feild" is in the official source)

---

## Field Constraints

### Text Constraints

| Property | Location | Type | Description |
|----------|----------|------|-------------|
| `format` | field level | string | Regex pattern for validation |
| `error_messages.format` | field level | string | Error message shown on format failure |
| `field_metadata.multiline` | field_metadata | boolean | Multi-line text input |

### Date Constraints

| Property | Location | Type | Description |
|----------|----------|------|-------------|
| `startDate` | field level | string or null | Earliest allowed date |
| `endDate` | field level | string or null | Latest allowed date |

### Enum/Select Constraints

| Property | Location | Type | Description |
|----------|----------|------|-------------|
| `display_type` | field level | string | `"dropdown"` or `"radio"` |
| `enum.advanced` | field level | boolean | Key-value pair mode |

### Taxonomy Constraints

| Property | Location | Type | Description |
|----------|----------|------|-------------|
| `taxonomies[].max_terms` | field level | number | Max terms per taxonomy |

### Number Constraints

**Not documented in the CMA spec.** The OpenAPI examples and official docs show no `min`/`max` properties for number fields.

### General Constraints

| Property | Type | Description |
|----------|------|-------------|
| `mandatory` | boolean | Field is required |
| `unique` | boolean | Values must be unique across entries |
| `multiple` | boolean | Field accepts array of values |
| `non_localizable` | boolean | Field excluded from localization |

---

## Content Type Options

Content types have an `options` object at the entity level:

```json
{
  "options": {
    "title": "title",
    "publishable": true,
    "is_page": true,
    "singleton": false,
    "sub_title": ["url"],
    "url_pattern": "/:title",
    "url_prefix": "/"
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Field UID used as entry title |
| `publishable` | boolean | Whether entries can be published |
| `is_page` | boolean | Whether this is a page-type content type |
| `singleton` | boolean | Whether only one entry is allowed |
| `sub_title` | string[] | Fields shown as subtitle |
| `url_pattern` | string | URL pattern template |
| `url_prefix` | string | URL prefix |

---

## DSL-to-CMA Mapping Table

| DSL FieldKind | CMA data_type | Distinguishing Flags | DSL options that survive roundtrip |
|---------------|---------------|---------------------|-------------------|
| `text` | `text` | none | `multiline`, `format`, `formatErrorMessage`, `errorMessages` |
| `number` | `number` | none | — |
| `boolean` | `boolean` | none | — |
| `date` | `isodate` | none | `startDate`, `endDate` |
| `json` | `json` | none | — |
| `file` | `file` | none | `extensions` |
| `link` | `link` | none | `field_metadata.default_value: {title, url}` (preserved via `metadata`) |
| `markdown` | `text` | `field_metadata.markdown: true` | — |
| `rich_text` | `text` | `field_metadata.allow_rich_text: true` | `richTextType` |
| `json_rte` | `json` | `field_metadata.allow_json_rte: true` | `richTextType`, `referenceTo`, `plugins` |
| `reference` | `reference` | none | `to` (CMA `reference_to: string[]`), `refMultipleContentTypes` |
| `global_field` | `global_field` | none | `ref` (CMA `reference_to: string`, single not array) |
| `enum` | `text` | `display_type` + `enum` present | `choices` (plain OR `{ key, value }`), `advanced`, `displayType`, `minInstance`, `maxInstance` |
| `group` | `group` | none | `fields` (CMA `schema`) |
| `modular_blocks` | `blocks` | none | `blocks` — each block is `{ uid, title, fields }` (CMA `schema`) OR `{ uid, title, globalFieldRef }` (CMA `reference_to: string` on the block) |
| `taxonomy` | `taxonomy` | none | `taxonomies[]: { taxonomy_uid, max_terms, mandatory, non_localizable }` |

All field kinds additionally support the base options: `nonLocalizable` (CMA `non_localizable`), `errorMessages` (full `error_messages` pass-through), `description`, `defaultValue`, `metadata`.

**Mapping direction notes:**
- CMA -> DSL: Must check `field_metadata` flags to disambiguate `text` and `json` variants.
- DSL -> CMA: Must set appropriate `field_metadata` flags and rename `data_type`. Modular blocks must emit `reference_to` (string) for global-field-reference blocks and `schema` (array) for inline blocks.

---

## Audit CLI Type Definitions

From `contentstack-audit/src/types/content-types.ts`:

```typescript
// Union of all handled field types
type ContentTypeSchemaType =
  | ReferenceFieldDataType
  | GlobalFieldDataType
  | ExtensionOrAppFieldDataType
  | JsonRTEFieldDataType
  | GroupFieldDataType
  | ModularBlocksDataType
  | SelectFeildStruct
  | any;  // catch-all for untyped fields (file, link, markdown, etc.)

// Base structure
type CommonDataTypeStruct = {
  uid: string;
  data_type: string;
  display_name: string;
  field_metadata: { ref_multiple: boolean; allow_json_rte: boolean } & AnyProperty;
  mandatory: boolean;
  multiple: boolean;
};

// data_type: 'reference'
type ReferenceFieldDataType = CommonDataTypeStruct & { reference_to: string[] };

// data_type: 'global_field'
type GlobalFieldDataType = CommonDataTypeStruct & {
  reference_to?: string;
  schema: GlobalFieldSchemaTypes[];
};

// data_type: 'json' with field_metadata.extension: true
type ExtensionOrAppFieldDataType = Omit<CommonDataTypeStruct, 'field_metadata'> & {
  extension_uid: string;
  field_metadata: { extension: boolean };
};

// data_type: 'json' with field_metadata.allow_json_rte: true
type JsonRTEFieldDataType = CommonDataTypeStruct & { reference_to: string[] };

// data_type: 'group'
type GroupFieldDataType = CommonDataTypeStruct & { schema: GroupFieldSchemaTypes[] };

// data_type: 'blocks'
type ModularBlocksDataType = CommonDataTypeStruct & { blocks: ModularBlockType[] };

// data_type: 'text'|'number' with display_type
type SelectFeildStruct = CommonDataTypeStruct & {
  display_type: string;
  enum: { advanced: string; choices: Record<string, unknown>[] };
  min_instance?: number;
  max_instance?: number;
  multiple: boolean;
};
```

**Types NOT explicitly defined** (pass through `| any`): `file`, `link`, `markdown`, `isodate`, `boolean`, `taxonomy`, plain `text`, plain `number`.

---

## Import CLI Behaviors

From `contentstack-import/src/`:

### Field Type Detection

The import CLI processes fields by `data_type` in these categories:

| data_type | Processing |
|-----------|-----------|
| `reference` | Validates target content types exist, remaps UIDs |
| `global_field` | Resolves nested schema, remaps UIDs |
| `json` (RTE) | Processes embedded entries/assets, remaps UIDs |
| `json` (extension) | Remaps extension UIDs |
| `json` (asset extension) | Remaps asset UIDs via `is_asset` flag |
| `text` (RTE) | Extracts embedded asset URLs, remaps |
| `text` (markdown) | Extracts v2/v3 asset URIs via regex |
| `group` | Recursive processing of nested schema |
| `blocks` | Recursive processing of each block's schema |
| `taxonomy` | Looks up taxonomy UIDs |
| `file`, `link`, `boolean`, `isodate`, `number` | Pass-through (no special processing) |

### Constraint Suppression During Import

The import CLI temporarily suppresses `mandatory` and `unique` constraints during content type creation (to avoid validation failures when entries don't exist yet):

```typescript
// Sets mandatory=false and unique=false for all fields except "title"
// Constraints are restored during the content type update phase
```

### Asset Detection in Entries

Assets are detected in entry values by checking:
```typescript
_.isPlainObject(object) && _.has(object, 'filename') && _.has(object, 'uid')
```

### Config Constants

```typescript
skipRefs: ['sys_assets']              // Skip asset references during ref validation
skipFieldTypes: ['taxonomy', 'group'] // Skip during fix operations
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v3/content_types` | List content types (paginated, 100/page) |
| POST | `/v3/content_types` | Create content type |
| PUT | `/v3/content_types/{uid}` | Update content type |
| GET | `/v3/global_fields` | List global fields (paginated, `api_version: 3.2`) |
| POST | `/v3/global_fields` | Create global field |
| PUT | `/v3/global_fields/{uid}` | Update global field |

### Required Headers

```
Content-Type: application/json
api_key: {stackApiKey}
authorization: {managementToken}
branch: {branchName}          // optional
api_version: {version}        // optional, required for global fields (3.2)
```

### Retryable Status Codes

- `429` - Rate limited (check `Retry-After` header)
- `5xx` - Server errors (exponential backoff)

### Non-Retryable Client Errors

- `400` - Bad request
- `401` - Authentication failed
- `403` - Authorization denied
- `404` - Not found

---

## System Fields

Content types always include these system-managed fields:

### Title Field

```json
{
  "data_type": "text",
  "display_name": "Title",
  "uid": "title",
  "field_metadata": { "_default": true },
  "mandatory": true,
  "unique": false,
  "multiple": false
}
```

### URL Field (for page-type content types)

```json
{
  "data_type": "text",
  "display_name": "URL",
  "uid": "url",
  "field_metadata": { "_default": true },
  "unique": false,
  "multiple": false
}
```

System fields are marked with `field_metadata._default: true`.
