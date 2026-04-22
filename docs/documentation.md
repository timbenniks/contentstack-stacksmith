# Contentstack Stacksmith Documentation

Define your Contentstack content types and global fields in TypeScript. Version-control them. Diff against a live stack. Apply safe, additive changes with a single command.

`@timbenniks/contentstack-stacksmith` is an infrastructure-as-code toolkit for Contentstack content models. Instead of clicking through the Contentstack dashboard to create and modify content types, you write TypeScript definitions that compile into a normalized schema, diff against your remote stack, and apply only safe changes.

---

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Scaffold a New Project](#scaffold-a-new-project)
  - [Build Your Schema](#build-your-schema)
  - [Plan Changes Against a Remote Stack](#plan-changes-against-a-remote-stack)
  - [Apply Changes](#apply-changes)
- [Core Concepts](#core-concepts)
  - [The Pipeline](#the-pipeline)
  - [Content Types and Global Fields](#content-types-and-global-fields)
  - [The Normalized Schema](#the-normalized-schema)
  - [Dependency System](#dependency-system)
  - [Safety Model and Risk Classification](#safety-model-and-risk-classification)
- [DSL API Reference](#dsl-api-reference)
  - [defineContentType](#definecontenttypeuid-definition)
  - [defineGlobalField](#defineglobalfielduid-definition)
  - [defineModels](#definemodelsregistry)
  - [defineModelsConfig](#definemodelsconfigconfig)
  - [Field Builders](#field-builders)
    - [text](#textuid-options)
    - [number](#numberuid-options)
    - [boolean](#booleanuid-options)
    - [date](#dateuid-options)
    - [json](#jsonuid-options)
    - [reference](#referenceuid-options)
    - [globalField](#globalfielduid-options)
    - [enumField](#enumfielduid-options)
    - [group](#groupuid-options)
    - [modularBlocks](#modularblocksuid-options)
    - [file](#fileuid-options)
    - [link](#linkuid-options)
    - [markdown](#markdownuid-options)
    - [richText](#richtextuid-options)
    - [jsonRte](#jsonrteuid-options)
    - [taxonomy](#taxonomyuid-options)
  - [Common Field Options](#common-field-options)
  - [Content Type Options](#content-type-options)
- [CLI Reference](#cli-reference)
  - [Shared Flags](#shared-flags)
  - [csdx stacksmith:init](#csdx-modelsinit)
  - [csdx stacksmith:import](#csdx-modelsimport)
  - [csdx stacksmith:build](#csdx-modelsbuild)
  - [csdx stacksmith:plan](#csdx-modelsplan)
  - [csdx stacksmith:diff](#csdx-modelsdiff)
  - [csdx stacksmith:apply](#csdx-modelsapply)
  - [csdx stacksmith:typegen](#csdx-modelstypegen)
  - [csdx stacksmith:promote](#csdx-modelspromote)
  - [csdx stacksmith:docs](#csdx-modelsdocs)
- [Configuration Reference](#configuration-reference)
  - [contentstack.stacksmith.config.ts](#contentstackmodelsconfigts)
  - [Project Structure Convention](#project-structure-convention)
- [Artifacts Reference](#artifacts-reference)
  - [schema.json](#schemajson)
  - [manifest.json](#manifestjson)
  - [plan.json](#planjson)
  - [diff.json](#diffjson)
- [Programmatic API](#programmatic-api)
  - [@timbenniks/contentstack-stacksmith](#timbennikscontentstack-stacksmith)
- [Examples](#examples)
  - [Basic Blog](#basic-blog)
  - [E-commerce Product Catalog](#e-commerce-product-catalog)
  - [Page Builder with Modular Blocks](#page-builder-with-modular-blocks)
  - [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)
  - [Common Errors](#common-errors)
  - [Validation Codes Reference](#validation-codes-reference)
- [Best Practices](#best-practices)

---

## Introduction

Contentstack Stacksmith brings infrastructure-as-code principles to your Contentstack content models. Instead of managing content types and global fields through the Contentstack dashboard, you define them in TypeScript, review changes in pull requests, and apply them through a CLI.

### What You Get

- **TypeScript DSL** for defining content types and global fields with full type safety and autocompletion
- **Normalized schema artifacts** that are deterministic, diffable, and version-controllable
- **Dependency-aware planning** that automatically resolves creation order and detects circular dependencies
- **Safe, additive apply** that only executes low-risk operations like creating new entities and adding fields
- **Breaking change detection** that blocks destructive operations like deleting content types or changing field types

### Package Overview

The release surface is intentionally small:

| Package | Purpose |
|---------|---------|
| `@timbenniks/contentstack-stacksmith` | TypeScript DSL plus schema normalization, diffing, planning, and validation |
| `@timbenniks/contentstack-stacksmith-cli` | Contentstack CLI plugin with `stacksmith:*` commands |

The lower-level workspace packages are internal implementation details and are not meant to be installed separately.

### Current Phase

This is **Phase 1** of the toolkit. The apply command currently only supports **additive, low-risk operations** such as creating new content types, creating new global fields, and adding new fields. Destructive operations like deleting content types, removing fields, or changing field types are detected and blocked. See [Safety Model and Risk Classification](#safety-model-and-risk-classification) for the full list.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** (or npm/yarn)
- **Contentstack CLI** (`csdx`) installed globally
- A **Contentstack stack** with a **management token** (for remote operations)

Install the Contentstack CLI if you haven't already:

```bash
npm install -g @contentstack/cli
```

### Installation

Install the DSL package in your project:

```bash
npm install @timbenniks/contentstack-stacksmith
```

Link the CLI plugin to the Contentstack CLI:

```bash
csdx plugins:link @timbenniks/contentstack-stacksmith-cli
```

After linking, the `stacksmith:*` commands become available:

```bash
csdx models --help
```

### Scaffold a New Project

The fastest way to get started is to scaffold a new project:

```bash
csdx stacksmith:init
```

You'll be prompted for a target directory (defaults to the current directory). The command creates the following file structure:

```
your-project/
  contentstack.stacksmith.config.ts    # Project configuration
  src/
    models/
      index.ts                     # Model registry (barrel file)
      content-types/
        author.ts                  # Example: Author content type
        blog-post.ts               # Example: Blog Post content type
      global-fields/
        seo.ts                     # Example: SEO global field
```

Let's look at each generated file:

**contentstack.stacksmith.config.ts** — Project configuration:

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "contentstack-stacksmith-project",
});
```

**src/models/index.ts** — The model registry that collects all definitions:

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
```

**src/models/content-types/author.ts** — A simple content type:

```typescript
import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});
```

**src/models/content-types/blog-post.ts** — A content type with references and global fields:

```typescript
import { defineContentType, globalField, reference, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

**src/models/global-fields/seo.ts** — A reusable global field:

```typescript
import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});
```

### Build Your Schema

Compile your TypeScript model definitions into normalized JSON artifacts:

```bash
csdx stacksmith:build
```

This produces two files in `.contentstack/models/`:

- **schema.json** — The normalized, deterministic schema representing all your content types and global fields
- **manifest.json** — Build metadata including a SHA-256 hash of the schema, compiler versions, and source file paths

The build step also validates your schema and reports any issues. If there are blocking validation errors (like duplicate UIDs or missing references), the command exits with code 1.

### Plan Changes Against a Remote Stack

Before applying changes, create a plan to see what would happen:

```bash
# Local-only plan (compares schema against an empty baseline)
csdx stacksmith:plan

# Plan against a remote Contentstack stack
csdx stacksmith:plan \
  --stack <your-stack-api-key> \
  --token-alias <your-token-alias> \
  --branch main
```

The plan shows every operation that would be executed, classified by risk level. It also generates a `plan.json` artifact with the full details.

### Apply Changes

Once you're satisfied with the plan, apply the changes:

```bash
csdx stacksmith:apply \
  --stack <your-stack-api-key> \
  --token-alias <your-token-alias>
```

The apply command:

1. Builds your schema
2. Fetches the current state of the remote stack
3. Creates a plan comparing local to remote
4. Checks that no operations are blocked
5. Prompts for confirmation (unless `--yes` or `--ci` is passed)
6. Applies all low-risk operations in dependency order

If the plan contains any blocked or high-risk operations, the apply command aborts with an error message explaining what is blocked and why.

---

## Core Concepts

### The Pipeline

Every operation follows this pipeline:

```
TypeScript Definitions
        |
        v
   [ Compile ]        DSL → Core schema format
        |
        v
   [ Normalize ]       Deterministic IDs, sorting, dependency extraction
        |
        v
   [ Validate ]        Check for missing references, duplicates, etc.
        |
        v
   [ Diff ]            Compare local schema to remote stack
        |
        v
   [ Plan ]            Order operations, classify risk, detect blocked changes
        |
        v
   [ Apply ]           Execute only safe, additive operations
```

Each stage is handled by a separate package, and you can use any stage independently through the [Programmatic API](#programmatic-api).

### Content Types and Global Fields

Contentstack has two kinds of content model entities:

- **Content Types** define the structure of entries. Think of them as database tables. Each content type has a unique identifier (UID), a title, and a set of fields. Examples: `blog_post`, `author`, `product`.

- **Global Fields** are reusable field groups that can be embedded into multiple content types. They're defined once and referenced by UID. When you update a global field, every content type that uses it gets the update. Examples: `seo`, `social_media`, `address`.

In the DSL, you create these with `defineContentType` and `defineGlobalField` respectively.

### The Normalized Schema

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

### Dependency System

The toolkit automatically tracks dependencies between entities:

- A **reference field** pointing to a content type creates a dependency from the entity containing the field to the referenced content type
- A **global field** embedded in a content type creates a dependency from the content type to the global field
- **Modular blocks** that contain reference or global field fields also create dependencies

Dependencies are used for:

1. **Topological sorting** — Entities are ordered so that dependencies are created before the entities that depend on them. For example, if `blog_post` references `author`, the `author` content type is created first.
2. **Cycle detection** — The dependency graph is checked for circular dependencies. If content type A references content type B which references content type A, this cycle is detected and reported.
3. **Operation ordering** — When applying changes to a remote stack, operations are executed in dependency order to ensure referenced entities exist before dependents are created.

### Safety Model and Risk Classification

Every operation generated by a diff is classified into one of four risk levels:

| Risk Level | Description | Behavior |
|------------|-------------|----------|
| **low** | Safe, additive operations | Allowed by `stacksmith:apply` |
| **medium** | Potentially problematic but not blocking | Reported as warnings |
| **high** | Risky operations that need future migration support | Blocks `stacksmith:apply` |
| **blocker** | Destructive or breaking changes | Blocks `stacksmith:apply` |

**Operations allowed in `stacksmith:apply` (low risk):**

| Operation | Description |
|-----------|-------------|
| Create content type | A new content type that doesn't exist on the remote stack |
| Create global field | A new global field that doesn't exist on the remote stack |
| Add field | A new optional field added to an existing entity |
| Update entity metadata | Title or description changes on an existing entity |
| Reorder fields | Changing the order of existing fields |
| Safe field updates | Non-breaking field property changes (e.g., display name, description) |

**Operations blocked in Phase 1 (blocker):**

| Operation | Reason |
|-----------|--------|
| Delete content type | Can destroy all entries of that content type |
| Delete global field | Can break all content types that reference it |
| Remove field | Can destroy existing field data across all entries |
| Change field type | Existing data may not be compatible with the new type |
| Change reference targets | Can break existing entry references |
| Make field required (false → true) | Existing entries without a value would become invalid |

**High-risk operations:**

| Operation | Reason |
|-----------|--------|
| Add required field | New entries require a value, and existing entries may need backfilling |

---

## DSL API Reference

### defineContentType(uid, definition)

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
| `definition.options` | `ContentTypeOptions?` | Optional Contentstack content type options. Typed interface with `title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`, plus arbitrary pass-through keys. See [Content Type Options](#content-type-options). |
| `definition.metadata` | `NormalizedMetadata?` | Optional metadata attached to the entity (labels, custom data). |

**Returns:** `ContentTypeDefinition`

---

### defineGlobalField(uid, definition)

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

---

### defineModels(registry)

Collects all your content type and global field definitions into a single model registry. This is typically used in your `src/models/index.ts` barrel file.

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

---

### defineModelsConfig(config)

Defines the project configuration. This is used in your `contentstack.stacksmith.config.ts` file.

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

### Field Builders

Field builders are functions that create field definitions for use inside content types and global fields. Each builder function returns a typed `FieldDefinition` object.

All field builders auto-generate a `title` from the `uid` if you don't provide one. The conversion splits on underscores and capitalizes each word:

- `meta_title` → `"Meta Title"`
- `blog_post` → `"Blog Post"`
- `name` → `"Name"`

---

#### text(uid, options?)

Creates a text field for storing strings. Supports multiline, regex format validation, and custom error messages.

```typescript
import { text } from "@timbenniks/contentstack-stacksmith";

text("title")
// { kind: "text", uid: "title", title: "Title", required: false, unique: false, multiple: false }

text("slug", { required: true, unique: true, description: "URL-friendly identifier" })

text("bio", { multiline: true, format: "^[a-zA-Z ]+$", formatErrorMessage: "Letters and spaces only" })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier within the entity. |
| `options.multiline` | `boolean?` | Enable multi-line text input. |
| `options.format` | `string?` | Regex pattern for validation. |
| `options.formatErrorMessage` | `string?` | Error message shown when format validation fails. |
| `options.defaultValue` | `string?` | Default string value. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### number(uid, options?)

Creates a number field for storing numeric values.

```typescript
import { number } from "@timbenniks/contentstack-stacksmith";

number("price")
// { kind: "number", uid: "price", title: "Price", required: false, ... }

number("sort_order", { required: true, defaultValue: 0 })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options` | `BaseFieldOptions?` | See [Common Field Options](#common-field-options). |

---

#### boolean(uid, options?)

Creates a boolean field for storing true/false values.

```typescript
import { boolean } from "@timbenniks/contentstack-stacksmith";

boolean("is_featured")
// { kind: "boolean", uid: "is_featured", title: "Is Featured", required: false, ... }

boolean("published", { defaultValue: false })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options` | `BaseFieldOptions?` | See [Common Field Options](#common-field-options). |

---

#### date(uid, options?)

Creates a date field for storing ISO date values. Maps to CMA `data_type: "isodate"`. Supports date range constraints.

```typescript
import { date } from "@timbenniks/contentstack-stacksmith";

date("publish_date")
// { kind: "date", uid: "publish_date", title: "Publish Date", required: false, ... }

date("event_date", { required: true, startDate: "2024-01-01", endDate: "2025-12-31" })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.startDate` | `string \| null?` | Earliest allowed date (ISO format). |
| `options.endDate` | `string \| null?` | Latest allowed date (ISO format). |
| `options.defaultValue` | `string?` | Default date value (ISO format). |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### json(uid, options?)

Creates a JSON field for storing arbitrary structured data.

```typescript
import { json } from "@timbenniks/contentstack-stacksmith";

json("raw_data")
// { kind: "json", uid: "raw_data", title: "Raw Data", required: false, ... }

json("configuration", { description: "Custom JSON configuration object" })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options` | `BaseFieldOptions?` | See [Common Field Options](#common-field-options). |

---

#### reference(uid, options)

Creates a reference field that links to entries of one or more content types. This automatically creates a **dependency** from the current entity to each referenced content type.

```typescript
import { reference } from "@timbenniks/contentstack-stacksmith";

// Reference a single content type
reference("author", { to: ["author"] })

// Reference multiple content types
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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.to` | `string[]` | **(required)** Array of content type UIDs that this field can reference. Each UID must correspond to a content type defined in your schema. |
| `options.refMultipleContentTypes` | `boolean?` | Maps to CMA `field_metadata.ref_multiple_content_types`. Set when you need to preserve the stack's explicit multi-content-type flag (e.g., for a clean import roundtrip). |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

Referenced content types must exist in your schema. If a reference points to a content type that isn't defined, the schema validation will produce a `MISSING_REFERENCE_TARGET` blocker finding.

---

#### globalField(uid, options)

Embeds a global field into a content type. This automatically creates a **dependency** from the current entity to the referenced global field.

```typescript
import { globalField } from "@timbenniks/contentstack-stacksmith";

globalField("seo", { ref: "seo" })

globalField("address", {
  ref: "address_block",
  description: "Shipping address using the shared address global field",
})
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier within the entity. |
| `options.ref` | `string` | **(required)** UID of the global field to embed. Must correspond to a global field defined in your schema. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

The referenced global field must exist in your schema. If it doesn't, the schema validation will produce a `MISSING_GLOBAL_FIELD` blocker finding.

---

#### enumField(uid, options)

Creates an enum (select) field with predefined choices. Requires at least one choice. Supports two modes:

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

enumField("priority", {
  choices: ["low", "medium", "high", "critical"],
  displayType: "radio",
  description: "Priority level for this item",
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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.choices` | `string[] \| EnumChoiceAdvanced[]` | **(required)** Array of allowed values. Use plain strings or `{ key, value }` pairs with `advanced: true`. |
| `options.advanced` | `boolean?` | Enable advanced key/value mode. When `true`, `choices` must be `{ key, value }` pairs. |
| `options.displayType` | `"dropdown" \| "radio"?` | UI widget type for the select field. |
| `options.minInstance` | `number?` | Minimum number of selections (requires `multiple: true`). Maps to CMA `min_instance`. |
| `options.maxInstance` | `number?` | Maximum number of selections (requires `multiple: true`). Maps to CMA `max_instance`. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### group(uid, options)

Creates a group field that nests other fields inside it. Groups let you organize related fields together.

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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.fields` | `FieldDefinition[]` | **(required)** Array of nested field definitions. You can use any field builder inside a group, including other groups. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### modularBlocks(uid, options)

Creates a modular blocks field — a flexible content area where editors can add, remove, and reorder blocks of different types.

Each block is one of two shapes:

- **Inline block** — `{ uid, title, fields }` with its own schema
- **Global-field-reference block** — `{ uid, title, globalFieldRef }` that reuses an existing global field's schema (maps to the CMA's `reference_to` on a block)

> **Note:** `modularBlocks` is the only field builder that defaults `multiple` to `true`. All other builders default `multiple` to `false`.

```typescript
import { modularBlocks, text, number, json, reference } from "@timbenniks/contentstack-stacksmith";

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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.blocks` | `ModularBlockDefinition[]` | **(required)** Array of block definitions. Each block is either `{ uid, title, fields }` (inline) or `{ uid, title, globalFieldRef }` (global-field reference). The two shapes are mutually exclusive per block. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). Note: `multiple` defaults to `true`. |

If a modular blocks field has no blocks (empty array), the schema validation will produce an `EMPTY_MODULAR_BLOCKS` medium-level finding.

Fields inside inline blocks can include reference fields and global field fields, which will create dependencies just like top-level fields do. Global-field-reference blocks create a `modular_block_reference` dependency in the normalized schema.

---

#### file(uid, options?)

Creates a file/asset picker field. Maps to CMA `data_type: "file"`.

```typescript
import { file } from "@timbenniks/contentstack-stacksmith";

file("hero_image")
// { kind: "file", uid: "hero_image", title: "Hero Image", ... }

file("document", { required: true, description: "Upload a PDF document" })

// Restrict to specific file extensions (maps to CMA `extensions`)
file("attachment", {
  extensions: ["pdf", "docx", "png", "jpg"],
})
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.extensions` | `string[]?` | File extension allowlist (without the leading dot). Maps to CMA `extensions`. Empty array is equivalent to omitting the option. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### link(uid, options?)

Creates a link field with title and URL. Maps to CMA `data_type: "link"`.

```typescript
import { link } from "@timbenniks/contentstack-stacksmith";

link("external_url")
// { kind: "link", uid: "external_url", title: "External Url", ... }

link("call_to_action", { required: true })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options` | `BaseFieldOptions?` | See [Common Field Options](#common-field-options). |

---

#### markdown(uid, options?)

Creates a markdown text field. Maps to CMA `data_type: "text"` with `field_metadata.markdown: true`.

```typescript
import { markdown } from "@timbenniks/contentstack-stacksmith";

markdown("body")
// { kind: "markdown", uid: "body", title: "Body", ... }
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options` | `BaseFieldOptions?` | See [Common Field Options](#common-field-options). |

---

#### richText(uid, options?)

Creates an HTML rich text editor field. Maps to CMA `data_type: "text"` with `field_metadata.allow_rich_text: true`.

```typescript
import { richText } from "@timbenniks/contentstack-stacksmith";

richText("content")
// { kind: "rich_text", uid: "content", richTextType: "advanced", ... }

richText("summary", { richTextType: "basic" })
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.richTextType` | `string?` | Editor feature set. Defaults to `"advanced"` and preserves custom CMA values such as `"custom"`. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### jsonRte(uid, options?)

Creates a JSON rich text editor field. Supports embedded entries via `referenceTo` and extension plugins via `plugins`. Maps to CMA `data_type: "json"` with `field_metadata.allow_json_rte: true`.

```typescript
import { jsonRte } from "@timbenniks/contentstack-stacksmith";

jsonRte("body")
// { kind: "json_rte", uid: "body", richTextType: "advanced", ... }

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

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.richTextType` | `string?` | Editor feature set. Defaults to `"advanced"` and preserves custom CMA values such as `"custom"`. |
| `options.referenceTo` | `string[]?` | Content type UIDs allowed for embedded entries. |
| `options.plugins` | `string[]?` | Extension UIDs for JSON RTE plugins. Maps to CMA `plugins`. |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). |

---

#### taxonomy(uid, options)

Creates a taxonomy field for term selection. Maps to CMA `data_type: "taxonomy"`.

```typescript
import { taxonomy } from "@timbenniks/contentstack-stacksmith";

taxonomy("categories", {
  taxonomies: [
    { taxonomy_uid: "product_categories", max_terms: 5 },
    { taxonomy_uid: "regions", max_terms: 3, mandatory: true },
  ],
})
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | `string` | Unique field identifier. |
| `options.taxonomies` | `TaxonomyRef[]` | **(required)** Array of taxonomy references. Each has `taxonomy_uid` (string), optional `max_terms` (number), optional `mandatory` (boolean), optional `multiple` (boolean), and optional `non_localizable` (boolean). |
| `options.*` | `BaseFieldOptions` | See [Common Field Options](#common-field-options). Note: `multiple` defaults to `true`. |

---

### Common Field Options

All field builders accept these base options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string?` | Auto-generated from `uid` | Human-readable display name. If omitted, generated by splitting the UID on underscores and capitalizing each word (`meta_title` → `"Meta Title"`). |
| `required` | `boolean?` | `false` | Whether the field must have a value. |
| `unique` | `boolean?` | `false` | Whether the field value must be unique across all entries of this content type. |
| `multiple` | `boolean?` | `false` (`true` for `modularBlocks` and `taxonomy`) | Whether the field accepts multiple values (array). |
| `nonLocalizable` | `boolean?` | — | Whether the field is excluded from localization. Maps to CMA `non_localizable`. |
| `description` | `string?` | — | Help text shown to editors in the Contentstack dashboard. |
| `defaultValue` | varies | — | Default value. Type-narrowed per field: `string` for text/date, `number` for number, `boolean` for boolean, `Record<string, unknown>` for json. |
| `errorMessages` | `Record<string, string>?` | — | Custom validation error messages keyed by error kind (e.g., `{ format: "Invalid slug." }`). |
| `metadata` | `Record<string, unknown>?` | — | Custom metadata attached to the field. |

> **UID validation:** All UIDs (fields and entities) must match `^[a-z][a-z0-9_]*$` — start with a lowercase letter, contain only lowercase letters, numbers, and underscores. Invalid UIDs throw immediately at authoring time.

---

### Content Type Options

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

---

## CLI Reference

The Contentstack Stacksmith CLI plugin adds `stacksmith:*` commands to the Contentstack CLI (`csdx`). All commands support human-readable output by default and machine-readable JSON output with the `--json` flag.

### Shared Flags

Flags are organized into three groups, shared across multiple commands:

**Automation flags** (available on all commands):

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--ci` | — | `false` | Disable prompts and require non-interactive behavior. |
| `--json` | — | `false` | Emit machine-readable JSON output. |

**Build flags** (available on `build`, `plan`, `diff`, `apply`):

| Flag | Short | Description |
|------|-------|-------------|
| `--config` | — | Path to `contentstack.stacksmith.config.ts`. |
| `--cwd` | — | Working directory for resolving project files. |
| `--out-dir` | — | Override the config output directory for generated artifacts. |

**Remote flags** (available on `plan`, `diff`, `apply`):

| Flag | Short | Description |
|------|-------|-------------|
| `--stack` | `-s` | Stack API key used for remote compare and apply. |
| `--token-alias` | `-t` | Contentstack management token alias. |
| `--branch` | — | Contentstack branch name. |
| `--region` | `-r` | Contentstack region alias. |

---

### csdx stacksmith:init

Scaffold a starter models-as-code project structure with example content types and a global field.

```bash
# Interactive — prompts for target directory
csdx stacksmith:init

# Non-interactive — specify directory
csdx stacksmith:init --dir ./my-models --yes

# Overwrite existing files
csdx stacksmith:init --dir ./my-models --force

# CI mode — no prompts, JSON output
csdx stacksmith:init --dir ./my-models --ci --json
```

**Flags:**

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--dir` | — | `.` (prompted) | Target directory to scaffold. |
| `--force` | — | `false` | Overwrite existing files. Without this flag, the command fails if any file already exists. |
| `--yes` | `-y` | `false` | Accept the default target directory without prompting. |
| `--ci` | — | `false` | Disable prompts. |
| `--json` | — | `false` | Return machine-readable JSON output. |

**Generated files:**

| File | Description |
|------|-------------|
| `contentstack.stacksmith.config.ts` | Project configuration with default settings |
| `src/models/index.ts` | Model registry importing all definitions |
| `src/models/content-types/author.ts` | Example content type with a required `name` field |
| `src/models/content-types/blog-post.ts` | Example content type with references and a global field |
| `src/models/global-fields/seo.ts` | Example global field with `meta_title` and `meta_description` |

---

### csdx stacksmith:import

Import content types and global fields from a Contentstack stack into DSL source files.

```bash
csdx stacksmith:import \
  --cwd ./apps/developers-cs-website \
  --stack blt123abc \
  --token-alias my-stack

csdx stacksmith:import \
  --cwd ./apps/developers-cs-website \
  --stack blt123abc \
  --token-alias my-stack \
  --force
```

**Flags:** source stack + automation flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--cwd` | — | `.` | Target project directory. |
| `--stack` | `-s` | — | Source stack API key. |
| `--token-alias` | `-t` | — | Management token alias for the source stack. |
| `--branch` | — | — | Source branch to import from. |
| `--force` | — | `false` | Replace existing import-managed model files. |
| `--ci` | — | `false` | Non-interactive mode. |
| `--json` | — | `false` | Emit machine-readable JSON output. |

**Behavior:**
- scaffolds a full target project when the directory is empty
- generates one file per global field and content type plus `src/models/index.ts`
- writes `.contentstack/models/import-manifest.json` to track refresh ownership
- refuses to overwrite generated model files unless `--force` is provided
- runs `stacksmith:build` and then rejects any residual diff against the source stack
- detects a surrounding monorepo (walks up looking for `pnpm-workspace.yaml`, a `package.json` with `workspaces`, or `lerna.json`) and uses `"@timbenniks/contentstack-stacksmith": "workspace:*"` in the generated `package.json` instead of a version literal, so `pnpm install` works without manual edits

**CMA property coverage (roundtrip-safe):**

The generated DSL captures every documented CMA field property, so a subsequent `stacksmith:apply` writes back exactly what was imported:

- Field-level: `required`, `unique`, `multiple`, `non_localizable`, `description`, `defaultValue`, full `errorMessages`, `metadata`
- Text: `format`, `formatErrorMessage`, `multiline`
- Date: `startDate`, `endDate`
- Enum: plain or advanced `{ key, value }` choices, `advanced`, `displayType`, `min_instance`, `max_instance`
- File: `extensions`
- Reference: `reference_to` (as `to`), `ref_multiple_content_types`
- Global field: `reference_to` as single string (as `ref`)
- JSON RTE: `rich_text_type`, embedded-entry `reference_to`, `plugins`
- Taxonomy: per-taxonomy `taxonomy_uid`, `max_terms`, `mandatory`, `non_localizable`
- Modular blocks: inline blocks **and** blocks that reference a global field via `reference_to` (generated as `{ uid, title, globalFieldRef }`)
- Content type `options`: typed `ContentTypeOptions` (`title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`) plus arbitrary pass-through keys

---

### csdx stacksmith:build

Compile TypeScript model definitions into normalized schema artifacts.

```bash
# Build from current directory
csdx stacksmith:build

# Build with custom config path
csdx stacksmith:build --config ./custom.config.ts

# Build with JSON output
csdx stacksmith:build --json

# Build to a custom output directory
csdx stacksmith:build --out-dir ./output
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

**Output artifacts:**

- `schema.json` — Normalized schema with all entities, fields, and dependencies
- `manifest.json` — Build metadata including schema hash, source files, and compiler versions

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Build succeeded (may include non-blocking warnings) |
| `1` | Build completed but has blocking validation findings (e.g., duplicate UIDs, missing references) |

---

### csdx stacksmith:plan

Create a dependency-aware plan by comparing local models to a target stack.

```bash
# Local-only plan (compare against empty baseline)
csdx stacksmith:plan

# Plan against a remote stack
csdx stacksmith:plan \
  --stack blt123abc \
  --token-alias my-stack \
  --branch main

# Write plan to a custom file
csdx stacksmith:plan --output ./my-plan.json

# JSON output for CI
csdx stacksmith:plan --stack blt123abc --token-alias my-stack --json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Description |
|----------------|-------------|
| `--output` | Write the plan JSON to a specific file. Defaults to `{outDir}/plan.json`. |

**Behavior:**

- Without remote flags: Compares your local schema against an empty baseline. Every entity and field appears as a `create_entity` or `add_field` operation.
- With remote flags: Fetches the current content types and global fields from your Contentstack stack and diffs against your local definitions.
- `--token-alias`, `--branch`, and `--region` require `--stack` so remote compares cannot silently fall back to an empty baseline.

The plan includes:
- All operations with their risk classification
- A summary with counts (creates, updates, deletes, blocked, low-risk, high-risk)
- Dependency order for safe execution
- All validation findings

---

### csdx stacksmith:diff

Show a raw diff between local models and a target stack. Similar to `stacksmith:plan` but outputs the raw diff operations without risk classification or dependency ordering.

```bash
# Diff against empty baseline
csdx stacksmith:diff

# Diff against a remote stack
csdx stacksmith:diff \
  --stack blt123abc \
  --token-alias my-stack

# JSON output
csdx stacksmith:diff --stack blt123abc --token-alias my-stack --json

# Write diff to a custom file
csdx stacksmith:diff --output ./my-diff.json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Description |
|----------------|-------------|
| `--output` | Write the diff JSON to a specific file. Defaults to `{outDir}/diff.json`. |

---

### csdx stacksmith:apply

Safely apply low-risk additive model changes to a Contentstack stack.

```bash
# Interactive apply with confirmation prompt
csdx stacksmith:apply \
  --stack blt123abc \
  --token-alias my-stack

# Skip confirmation
csdx stacksmith:apply \
  --stack blt123abc \
  --token-alias my-stack \
  --yes

# Full CI mode
csdx stacksmith:apply \
  --stack blt123abc \
  --token-alias my-stack \
  --yes --ci --json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Short | Default | Description |
|----------------|-------|---------|-------------|
| `--yes` | `-y` | `false` | Skip the confirmation prompt after validations pass. |

**Requirements:**

- `--stack` is **required** (the command exits with an error without it)
- A management token is **required** (via `--token-alias`, CLI config, or environment variables `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN`)

**Safety checks:**

1. If the plan contains **any blocked operations** (blocker-level), apply aborts with an error
2. Only **low-risk operations** are executed
3. Operations are executed in **dependency order** (dependencies created before dependents)
4. A **confirmation prompt** is shown before applying (unless `--yes` or `--ci`)

**Token resolution order:**

The management token is resolved from these sources, in order:

1. Token alias (`--token-alias` flag, resolved via `csdx auth:tokens:list`)
2. CLI config auth token
3. Environment variable `CS_AUTHTOKEN`
4. Environment variable `CONTENTSTACK_MANAGEMENT_TOKEN`

---

### csdx stacksmith:typegen

Generate TypeScript type definitions from a Contentstack stack's content types. Wraps the official `@contentstack/types-generator` library.

```bash
# Generate types for REST API
csdx stacksmith:typegen \
  --token-alias my-delivery-token \
  --output ./types/contentstack.d.ts

# With prefix and system fields
csdx stacksmith:typegen \
  --token-alias my-delivery-token \
  --output ./types/contentstack.d.ts \
  --prefix I \
  --include-system-fields

# Generate GraphQL types
csdx stacksmith:typegen \
  --token-alias my-delivery-token \
  --output ./types/graphql.d.ts \
  --api-type graphql \
  --namespace ContentstackTypes
```

**Flags:** [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--token-alias` | `-a` | — | **(required)** Delivery token alias. |
| `--output` | `-o` | — | **(required)** Output file path. |
| `--prefix` | `-p` | `""` | Interface prefix (e.g. `"I"` for `IBlogPost`). |
| `--doc` / `--no-doc` | `-d` | `true` | Include JSDoc comments. |
| `--branch` | — | — | Branch to generate types from. |
| `--include-system-fields` | — | `false` | Include `uid`, `created_at`, etc. |
| `--include-editable-tags` | — | `false` | Include editable tags for visual builder. |
| `--include-referenced-entry` | — | `false` | Add a generic `ReferencedEntry` interface. |
| `--api-type` | — | `rest` | `rest` or `graphql`. |
| `--namespace` | — | — | Namespace for GraphQL types. |

---

### csdx stacksmith:promote

Promote models from local definitions or a source stack to a target stack.

```bash
# Local to remote (uses compiled local models as source)
csdx stacksmith:promote \
  --stack blt_target \
  --token-alias target-token

# Stack to stack
csdx stacksmith:promote \
  --source-stack blt_dev \
  --source-token-alias dev-token \
  --stack blt_staging \
  --token-alias staging-token
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--source-stack` | — | — | Source stack API key. If omitted, local compiled models are used. |
| `--source-token-alias` | — | — | Management token alias for the source stack. |
| `--source-branch` | — | — | Branch on the source stack. |
| `--stack` | `-s` | — | **(required)** Target stack API key. |
| `--token-alias` | — | — | **(required)** Management token alias for the target stack. |
| `--branch` | — | — | Branch on the target stack. |
| `--yes` | `-y` | `false` | Skip confirmation prompt. |

Uses the same safety model as `stacksmith:apply` — blocked operations are rejected.

---

### csdx stacksmith:docs

Generate documentation from compiled model definitions in Markdown, JSON, or HTML.

```bash
csdx stacksmith:docs

csdx stacksmith:docs --format json --output ./docs/content-models.json

csdx stacksmith:docs --format html --output ./docs/content-models.html
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--format` | — | `md` | Documentation format: `md`, `json`, or `html`. |
| `--output` | — | `{outDir}/models.<ext>` | Output file path. |

**Output includes:**
- Entity list with field tables (uid, kind, required, description)
- Dependency relationships per entity
- A dependency graph section

---

## Configuration Reference

### contentstack.stacksmith.config.ts

Your project configuration file. It must export a `ModelsConfig` object using `defineModelsConfig`.

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-website",           // Required: project identifier
  modelsEntry: "./src/models/index.ts", // Default: "./src/models/index.ts"
  outDir: "./.contentstack/models",     // Default: "./.contentstack/models"
  strict: true,                         // Default: true
  region: "EU",                         // Optional: region override
  branch: "development",               // Optional: branch override
  defaults: {                           // Optional: custom defaults
    defaultLocale: "en-us",
  },
});
```

**Full property reference:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `projectName` | `string` | **(required)** | Identifier for the project, used in manifest metadata and output formatting. |
| `modelsEntry` | `string` | `"./src/models/index.ts"` | Path to the barrel file that exports the `ModelRegistry`. Resolved relative to the config file location. |
| `outDir` | `string` | `"./.contentstack/models"` | Directory where build artifacts (`schema.json`, `manifest.json`, `plan.json`) are written. Resolved relative to the working directory. |
| `strict` | `boolean` | `true` | Enable strict schema validation during build. When `true`, all validation rules are applied. |
| `region` | `string` | — | Contentstack region override. Takes precedence over the CLI's configured region. Common values: `"NA"`, `"EU"`, `"AZURE-NA"`, `"AZURE-EU"`. |
| `branch` | `string` | — | Contentstack branch override. Takes precedence over the `--branch` CLI flag. |
| `defaults` | `Record<string, unknown>` | — | Arbitrary key-value pairs for custom use in your project. Not consumed by the framework directly. |

The configuration file is loaded at runtime using [jiti](https://github.com/unjs/jiti), so it can be real TypeScript — no separate compilation step is needed.

### Project Structure Convention

The recommended project structure follows the scaffolded layout:

```
your-project/
  contentstack.stacksmith.config.ts         # Project configuration
  src/
    models/
      index.ts                          # Model registry (barrel file)
      content-types/
        author.ts                       # One file per content type
        blog-post.ts
        product.ts
      global-fields/
        seo.ts                          # One file per global field
        address.ts
  .contentstack/
    models/
      schema.json                       # Generated: normalized schema
      manifest.json                     # Generated: build metadata
      plan.json                         # Generated: execution plan
      diff.json                         # Generated: raw diff
```

**Conventions:**

- One entity per file for readability and clean diffs
- Use `snake_case` for entity and field UIDs (e.g., `blog_post`, `meta_title`)
- Separate directories for content types and global fields
- The `.contentstack/` directory contains generated artifacts — add it to `.gitignore` or commit it, depending on your workflow

---

## Artifacts Reference

### schema.json

The normalized, deterministic representation of all your content models. Generated by `stacksmith:build`.

```json
{
  "schemaVersion": 1,
  "entities": [
    {
      "id": "content_type:author",
      "kind": "content_type",
      "uid": "author",
      "title": "Author",
      "fields": [
        {
          "id": "content_type:author.field:name",
          "uid": "name",
          "displayName": "Name",
          "kind": "text",
          "order": 0,
          "required": true,
          "unique": false,
          "multiple": false,
          "metadata": {},
          "dependencies": []
        }
      ],
      "dependencies": [],
      "metadata": {
        "origin": "dsl"
      }
    }
  ],
  "metadata": {
    "origin": "dsl"
  }
}
```

**Top-level properties:**

| Property | Type | Description |
|----------|------|-------------|
| `schemaVersion` | `number` | Schema format version. Currently `1`. |
| `entities` | `CompiledEntity[]` | Array of all content types and global fields, sorted by kind and UID. |
| `metadata` | `NormalizedMetadata` | Schema-level metadata. Includes `origin: "dsl"` when compiled from TypeScript. |

**CompiledEntity properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Entity identifier in the format `{kind}:{uid}`. |
| `kind` | `"content_type" \| "global_field"` | Entity type. |
| `uid` | `string` | Unique identifier. |
| `title` | `string` | Display name. |
| `description` | `string?` | Optional description. |
| `fields` | `CompiledField[]` | Ordered array of compiled fields. |
| `dependencies` | `DependencyRef[]` | Aggregated dependencies from all fields. |
| `metadata` | `NormalizedMetadata` | Entity metadata. |
| `options` | `ContentTypeOptions?` | Content type options (content types only). Typed fields: `title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`, plus arbitrary pass-through keys. |

**CompiledField properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Field identifier in the format `{entityId}.field:{uid}`. |
| `uid` | `string` | Field identifier within the entity. |
| `displayName` | `string` | Human-readable field name. |
| `kind` | `FieldKind` | Field type: `"text"`, `"number"`, `"boolean"`, `"date"`, `"json"`, `"file"`, `"link"`, `"markdown"`, `"rich_text"`, `"json_rte"`, `"reference"`, `"group"`, `"enum"`, `"modular_blocks"`, `"global_field"`, or `"taxonomy"`. |
| `order` | `number` | Zero-based position in the fields array, preserving declaration order. |
| `required` | `boolean` | Whether the field is required. |
| `unique` | `boolean` | Whether values must be unique. |
| `multiple` | `boolean` | Whether the field accepts multiple values. |
| `nonLocalizable` | `boolean?` | Whether the field is excluded from localization. |
| `description` | `string?` | Optional field description. |
| `defaultValue` | `unknown?` | Default value. |
| `enumChoices` | `string[]? \| EnumChoiceAdvanced[]?` | Allowed values; plain strings OR `{ key, value }` pairs when `enumAdvanced` is true. |
| `enumAdvanced` | `boolean?` | Flags enum advanced key/value mode. |
| `minInstance`, `maxInstance` | `number?` | Enum multi-select bounds. |
| `referenceTo` | `string[]?` | Target content type UIDs for reference fields, or embedded-entry types for JSON RTE. |
| `refMultipleContentTypes` | `boolean?` | Preserves the CMA `ref_multiple_content_types` flag on reference fields. |
| `globalFieldRef` | `string?` | Referenced global field UID for global_field fields. |
| `fields` | `CompiledField[]?` | Nested fields for group fields. |
| `blocks` | `CompiledBlock[]?` | Block definitions for modular_blocks fields. Each block is `{ uid, title, fields }` (inline) OR `{ uid, title, globalFieldRef }` (global-field reference). |
| `plugins` | `string[]?` | Extension plugin UIDs for JSON RTE fields. |
| `errorMessages` | `Record<string, string>?` | Custom validation error messages keyed by error kind. |
| `extensions` | `string[]?` | File extension allowlist for file fields. |
| `metadata` | `Record<string, unknown>` | Field-level metadata (CMA `field_metadata`, minus keys tracked as first-class properties). |
| `dependencies` | `DependencyRef[]` | Dependencies created by this field (references, global-field usages, and modular-block global-field embeddings). |

**DependencyRef properties:**

| Property | Type | Description |
|----------|------|-------------|
| `sourceEntityId` | `string` | ID of the entity that contains the dependency. |
| `targetEntityId` | `string` | ID of the entity being depended on. |
| `sourceFieldId` | `string?` | ID of the field creating the dependency. |
| `kind` | `EntityKind` | Kind of the target entity. |
| `uid` | `string` | UID of the target entity. |
| `reason` | `"reference" \| "global_field" \| "modular_block_reference"` | Why the dependency exists. |
| `description` | `string` | Human-readable description. |

---

### manifest.json

Build metadata generated alongside `schema.json`. Contains information about the build environment and a hash of the schema for change detection.

```json
{
  "projectName": "my-website",
  "compilerVersion": "0.1.0",
  "packageVersions": {
    "cli": "0.1.0",
    "models": "0.1.0"
  },
  "schemaHash": "a1b2c3d4e5f6...",
  "sourceFiles": [
    "src/models/index.ts",
    "src/models/content-types/author.ts",
    "src/models/content-types/blog-post.ts",
    "src/models/global-fields/seo.ts"
  ],
  "artifacts": {
    "schema": ".contentstack/models/schema.json",
    "manifest": ".contentstack/models/manifest.json"
  }
}
```

| Property | Description |
|----------|-------------|
| `projectName` | From your `contentstack.stacksmith.config.ts`. |
| `compilerVersion` | Version of the CLI package that compiled the schema. |
| `packageVersions` | Versions of the published library and CLI packages (`models`, `cli`). |
| `schemaHash` | SHA-256 hash of the canonical `schema.json`. Use this to detect changes between builds. |
| `sourceFiles` | List of TypeScript files that contributed to the schema. |
| `artifacts` | Paths to the generated artifact files. |

---

### plan.json

The execution plan generated by `stacksmith:plan`. Contains all operations, their risk classification, dependency ordering, and validation findings.

```json
{
  "schemaVersion": 1,
  "operations": [
    {
      "id": "create:content_type:author",
      "kind": "create_entity",
      "entity": {
        "id": "content_type:author",
        "kind": "content_type",
        "uid": "author"
      },
      "status": "pending",
      "summary": "Create content type author",
      "details": [ ... ],
      "dependencies": [],
      "risks": []
    }
  ],
  "summary": {
    "total": 5,
    "creates": 3,
    "updates": 2,
    "deletes": 0,
    "blocked": 0,
    "lowRisk": 5,
    "highRisk": 0
  },
  "dependencyOrder": [
    "global_field:seo",
    "content_type:author",
    "content_type:blog_post"
  ],
  "dependencyNotes": [
    "blog_post depends on global field seo",
    "blog_post references author"
  ],
  "validationFindings": [ ... ]
}
```

**PlanOperation properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Operation identifier (e.g., `create:content_type:author`). |
| `kind` | `OperationKind` | Operation type: `create_entity`, `update_entity`, `delete_entity`, `add_field`, `update_field`, `remove_field`, `reorder_fields`. |
| `entity` | `EntityRef` | Reference to the affected entity (id, kind, uid). |
| `fieldUid` | `string?` | Affected field UID for field-level operations. |
| `status` | `"pending" \| "blocked" \| "applied"` | Current status. `blocked` if any blocker-level finding is associated. |
| `summary` | `string` | Human-readable operation summary. |
| `details` | `DiffChange[]` | Specific property changes (path, before, after, message). |
| `dependencies` | `string[]` | Operation IDs that must complete before this one. |
| `risks` | `PlanRisk[]` | Associated risk assessments. |

**PlanSummary properties:**

| Property | Description |
|----------|-------------|
| `total` | Total number of operations. |
| `creates` | Number of `create_entity` operations. |
| `updates` | Number of `update_entity`, `add_field`, `update_field`, and `reorder_fields` operations. |
| `deletes` | Number of `delete_entity` and `remove_field` operations. |
| `blocked` | Number of operations with `status: "blocked"`. |
| `lowRisk` | Number of operations where all risks are low (excludes zero-risk operations). |
| `mediumRisk` | Number of operations with at least one medium-risk finding. |
| `highRisk` | Number of high-risk or blocker operations. |

---

### diff.json

The raw diff output generated by `stacksmith:diff`. Contains the local and remote schemas alongside all detected operations.

```json
{
  "local": { ... },
  "remote": { ... },
  "operations": [ ... ],
  "warnings": []
}
```

| Property | Type | Description |
|----------|------|-------------|
| `local` | `SchemaArtifact` | The normalized local schema. |
| `remote` | `SchemaArtifact` | The normalized remote schema (empty if no remote connection). |
| `operations` | `PlanOperation[]` | Detected differences as operations. |
| `warnings` | `PlanRisk[]` | Top-level warnings. |

---

## Programmatic API

The main library package can be used programmatically without the CLI. It exports the DSL plus the supported schema, diff, plan, and validation helpers. The lower-level workspace packages are internal and are not meant to be installed separately.

### @timbenniks/contentstack-stacksmith

Install the main library package once:

```bash
npm install @timbenniks/contentstack-stacksmith
```

#### normalizeSchema(input)

Normalizes a raw schema input into a deterministic `SchemaArtifact`. Generates entity and field IDs, extracts dependencies, deduplicates them, and sorts entities.

```typescript
import { normalizeSchema } from "@timbenniks/contentstack-stacksmith";

const schema = normalizeSchema({
  entities: [
    {
      kind: "content_type",
      uid: "blog_post",
      title: "Blog Post",
      metadata: {},
      fields: [
        {
          uid: "title",
          displayName: "Title",
          kind: "text",
          required: true,
          unique: false,
          multiple: false,
          metadata: {},
        },
      ],
    },
  ],
  metadata: { origin: "dsl" },
});
// Returns SchemaArtifact with computed IDs and dependencies
```

#### diffSchemas(local, remote?)

Compares two schema artifacts and generates a list of operations representing the differences.

```typescript
import { diffSchemas } from "@timbenniks/contentstack-stacksmith";

const diff = diffSchemas(localSchema, remoteSchema);
// Returns DiffResult with operations and warnings

// Without remote (compares against empty baseline)
const localDiff = diffSchemas(localSchema);
```

#### buildDependencyGraph(schema)

Builds a dependency graph from a schema artifact. Uses Kahn's algorithm for topological sorting and depth-first search for cycle detection.

```typescript
import { buildDependencyGraph } from "@timbenniks/contentstack-stacksmith";

const graph = buildDependencyGraph(schema);
// graph.order — entity IDs in topological order (dependencies first)
// graph.reverseOrder — reverse topological order (dependents first)
// graph.cycles — detected circular dependencies (empty if none)
// graph.nodes — all entity references
// graph.edges — all dependency edges
```

#### createPlan(diff, graph?, findings?)

Assembles a complete execution plan from a diff result, optional dependency graph, and optional validation findings.

```typescript
import { createPlan, diffSchemas, buildDependencyGraph } from "@timbenniks/contentstack-stacksmith";
import { validateSchema, validateDiff } from "@timbenniks/contentstack-stacksmith";

const diff = diffSchemas(localSchema, remoteSchema);
const graph = buildDependencyGraph(localSchema);
const findings = [...validateSchema(localSchema), ...validateDiff(diff)];
const plan = createPlan(diff, graph, findings);
// Returns PlanArtifact with ordered operations, summary, and findings
```

#### toCanonicalJson(value)

Converts any value to a canonical JSON string with sorted object keys and 2-space indentation. Used internally for deterministic hashing and comparison.

```typescript
import { toCanonicalJson } from "@timbenniks/contentstack-stacksmith";

const json = toCanonicalJson({ z: 1, a: 2 });
// '{\n  "a": 2,\n  "z": 1\n}'
```

#### Exported Types

The package exports the normalized schema types most likely to appear in application code:

```typescript
import type {
  SchemaArtifact,
  CompiledEntity,
  CompiledContentType,
  CompiledGlobalField,
  CompiledField,
  CompiledBlock,
  NormalizableFieldInput,
  NormalizableBlockInput,
  DependencyRef,
  TaxonomyRef,
  FieldKind,
  ContentTypeOptions,
  EnumChoiceAdvanced,
} from "@timbenniks/contentstack-stacksmith";
```

- `ContentTypeOptions` — typed interface for `CompiledContentType.options` (see [Content Type Options](#content-type-options)).
- `EnumChoiceAdvanced` — `{ key: string; value: string }` pair used when `CompiledField.enumAdvanced` is `true`.
- `CompiledBlock` — `{ uid, title, fields? }` for inline blocks OR `{ uid, title, globalFieldRef }` for blocks that reuse a global field's schema.
- `DependencyRef.reason` — `"reference" | "global_field" | "modular_block_reference"`. The `modular_block_reference` reason is emitted when a modular block embeds a global field.

#### DSL Authoring Helpers

The same package also exports all [definition functions](#dsl-api-reference) and [field builders](#field-builders), plus compilation functions.

#### compileDefinitions(definitions)

Compiles an array of `ModelDefinition` objects into a normalized `SchemaArtifact`. Validates that no duplicate entity UIDs exist.

```typescript
import { compileDefinitions, defineContentType, defineGlobalField, text, reference, globalField } from "@timbenniks/contentstack-stacksmith";

const author = defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});

const seo = defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});

const blogPost = defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});

const schema = compileDefinitions([author, seo, blogPost]);
// Returns SchemaArtifact
```

#### compileModelRegistry(registry)

Compiles a `ModelRegistry` (as returned by `defineModels`) into a `SchemaArtifact`. Convenience wrapper that flattens the registry and calls `compileDefinitions`.

```typescript
import { compileModelRegistry, defineModels } from "@timbenniks/contentstack-stacksmith";

const registry = defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});

const schema = compileModelRegistry(registry);
```

#### flattenDefinitions(registry)

Flattens a `ModelRegistry` into a single array of `ModelDefinition` objects. Combines `definitions`, `globalFields`, and `contentTypes` arrays in that order.

```typescript
import { flattenDefinitions } from "@timbenniks/contentstack-stacksmith";

const definitions = flattenDefinitions(registry);
// Returns ModelDefinition[]
```

#### Validation Helpers

The same package also exports schema validation, diff validation, and plan-level risk analysis.

#### validateSchema(schema)

Validates a `SchemaArtifact` for structural issues. Returns an array of `ValidationFinding` objects.

```typescript
import { validateSchema } from "@timbenniks/contentstack-stacksmith";

const findings = validateSchema(schema);
for (const finding of findings) {
  console.log(`[${finding.level}] ${finding.code}: ${finding.message}`);
}
```

**Checks performed:**

| Code | Level | Trigger |
|------|-------|---------|
| `DUPLICATE_UID` | blocker | Two entities share the same kind:uid combination, or two fields within an entity share the same uid |
| `MISSING_REFERENCE_TARGET` | blocker | A reference field points to a content type that doesn't exist in the schema |
| `MISSING_GLOBAL_FIELD` | blocker | A global_field field references a global field that doesn't exist in the schema |
| `EMPTY_MODULAR_BLOCKS` | medium | A modular_blocks field has no blocks defined |

#### validateDiff(diff)

Validates a `DiffResult` for breaking changes and classifies each operation by risk level.

```typescript
import { validateDiff } from "@timbenniks/contentstack-stacksmith";

const findings = validateDiff(diff);
```

**Checks performed:**

| Code | Level | Trigger |
|------|-------|---------|
| `DESTRUCTIVE_CHANGE` | blocker | `delete_entity` or `remove_field` operation |
| `BREAKING_FIELD_MUTATION` | blocker | `update_field` that changes field type, reference targets, or tightens required (false → true) |
| `RISKY_REQUIRED_FIELD` | high | `add_field` where the new field is required |
| `SAFE_FIELD_UPDATE` | low | `update_field` with non-breaking changes (display name, description, etc.) |
| `SAFE_ADDITIVE_CHANGE` | low | `add_field` where the new field is optional |
| `SAFE_ENTITY_CHANGE` | low | `create_entity`, `update_entity`, or `reorder_fields` |

#### analyzePlanRisk(plan)

Produces summary-level risk findings for a complete plan.

```typescript
import { analyzePlanRisk } from "@timbenniks/contentstack-stacksmith";

const findings = analyzePlanRisk(plan);
```

| Code | Level | Trigger |
|------|-------|---------|
| `PLAN_BLOCKED` | blocker | Plan contains one or more blocked operations |
| `HIGH_RISK_OPERATIONS` | high | Plan contains one or more high-risk operations |

---

## Examples

### Basic Blog

A complete blog setup with authors, posts, and reusable SEO metadata.

**contentstack.stacksmith.config.ts**

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-blog",
});
```

**src/models/global-fields/seo.ts**

```typescript
import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  description: "SEO metadata reused across content types.",
  fields: [
    text("meta_title"),
    text("meta_description"),
  ],
});
```

**src/models/content-types/author.ts**

```typescript
import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  description: "Blog post authors.",
  fields: [
    text("name", { required: true }),
    text("bio"),
  ],
});
```

**src/models/content-types/blog-post.ts**

```typescript
import { defineContentType, text, date, boolean, reference, globalField } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  description: "A blog post with author attribution and SEO metadata.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    text("excerpt", { description: "Short summary shown in blog listing pages." }),
    date("publish_date"),
    boolean("is_featured", { defaultValue: false }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

**src/models/index.ts**

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
```

**Build and apply:**

```bash
# Build the schema
csdx stacksmith:build

# Preview what would change on the remote stack
csdx stacksmith:plan --stack blt123abc --token-alias my-stack

# Apply the changes
csdx stacksmith:apply --stack blt123abc --token-alias my-stack
```

---

### E-commerce Product Catalog

A product catalog with categories, enum fields, and grouped nested fields.

**src/models/content-types/category.ts**

```typescript
import { defineContentType, text, number } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("category", {
  title: "Category",
  description: "Product categories for organizing the catalog.",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("description"),
    number("sort_order", { defaultValue: 0 }),
  ],
});
```

**src/models/content-types/product.ts**

```typescript
import {
  defineContentType,
  text,
  number,
  boolean,
  json,
  enumField,
  reference,
  group,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("product", {
  title: "Product",
  description: "A product in the e-commerce catalog.",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("short_description"),
    json("full_description", { description: "Rich text product description." }),
    number("price", { required: true }),
    number("compare_at_price", { description: "Original price before discount." }),
    text("sku", { required: true, unique: true }),
    number("stock_quantity", { defaultValue: 0 }),
    boolean("is_active", { defaultValue: true }),
    enumField("status", {
      choices: ["draft", "active", "discontinued", "out_of_stock"],
      required: true,
      defaultValue: "draft",
    }),
    reference("categories", {
      to: ["category"],
      multiple: true,
      description: "Categories this product belongs to.",
    }),
    group("dimensions", {
      fields: [
        number("weight"),
        number("length"),
        number("width"),
        number("height"),
        text("unit", { defaultValue: "cm" }),
      ],
      description: "Physical dimensions for shipping calculation.",
    }),
    group("pricing_tiers", {
      fields: [
        number("wholesale_price"),
        number("minimum_quantity"),
      ],
      multiple: true,
      description: "Volume-based pricing tiers.",
    }),
  ],
});
```

**src/models/index.ts**

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import category from "./content-types/category";
import product from "./content-types/product";

export default defineModels({
  contentTypes: [category, product],
});
```

---

### Page Builder with Modular Blocks

A flexible page builder using modular blocks for composable page layouts, plus a shared CTA global field.

**src/models/global-fields/cta.ts**

```typescript
import { defineGlobalField, text, enumField } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("cta", {
  title: "Call to Action",
  description: "Reusable CTA button configuration.",
  fields: [
    text("label", { required: true }),
    text("url", { required: true }),
    enumField("style", {
      choices: ["primary", "secondary", "outline", "ghost"],
      defaultValue: "primary",
    }),
    enumField("target", {
      choices: ["_self", "_blank"],
      defaultValue: "_self",
    }),
  ],
});
```

**src/models/content-types/page.ts**

```typescript
import {
  defineContentType,
  text,
  number,
  json,
  boolean,
  reference,
  globalField,
  modularBlocks,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("page", {
  title: "Page",
  description: "A composable page built with modular content blocks.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    modularBlocks("content", {
      blocks: [
        {
          uid: "hero",
          title: "Hero Section",
          fields: [
            text("heading", { required: true }),
            text("subheading"),
            text("background_image_url"),
            globalField("cta", { ref: "cta" }),
          ],
        },
        {
          uid: "rich_text",
          title: "Rich Text",
          fields: [
            json("body", { required: true }),
          ],
        },
        {
          uid: "image_gallery",
          title: "Image Gallery",
          fields: [
            text("gallery_title"),
            json("images", { multiple: true }),
            number("columns", { defaultValue: 3 }),
          ],
        },
        {
          uid: "featured_content",
          title: "Featured Content",
          fields: [
            text("section_title"),
            reference("items", { to: ["blog_post", "product"], multiple: true }),
            number("max_items", { defaultValue: 4 }),
          ],
        },
        {
          uid: "testimonial",
          title: "Testimonial",
          fields: [
            text("quote", { required: true }),
            text("author_name", { required: true }),
            text("author_title"),
          ],
        },
        // Global-field-reference block — reuses the `cta` global field as a block
        {
          uid: "cta_banner",
          title: "CTA Banner",
          globalFieldRef: "cta",
        },
      ],
    }),
    globalField("seo", { ref: "seo" }),
    boolean("is_published", { defaultValue: false }),
  ],
});
```

**src/models/index.ts**

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import blogPost from "./content-types/blog-post";
import product from "./content-types/product";
import page from "./content-types/page";
import seo from "./global-fields/seo";
import cta from "./global-fields/cta";

export default defineModels({
  contentTypes: [blogPost, product, page],
  globalFields: [seo, cta],
});
```

---

### CI/CD Pipeline

Integrate content model changes into your CI/CD workflow for safe, automated deployments.

**GitHub Actions workflow:**

```yaml
name: Content Models

on:
  push:
    branches: [main]
    paths:
      - 'src/models/**'
      - 'contentstack.stacksmith.config.ts'
  pull_request:
    paths:
      - 'src/models/**'
      - 'contentstack.stacksmith.config.ts'

jobs:
  validate:
    name: Build & Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx csdx stacksmith:build --json
        # Exits with code 1 if there are blocking validation findings

  plan:
    name: Plan Changes (Staging)
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'pull_request'
    env:
      CS_AUTHTOKEN: ${{ secrets.CONTENTSTACK_MANAGEMENT_TOKEN_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: |
          npx csdx stacksmith:plan \
            --stack ${{ secrets.CONTENTSTACK_STACK_STAGING }} \
            --region EU \
            --json --ci
        # Review the plan output in the PR workflow logs

  apply-staging:
    name: Apply to Staging
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main'
    env:
      CS_AUTHTOKEN: ${{ secrets.CONTENTSTACK_MANAGEMENT_TOKEN_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: |
          npx csdx stacksmith:apply \
            --stack ${{ secrets.CONTENTSTACK_STACK_STAGING }} \
            --region EU \
            --yes --ci --json
```

**Multi-environment strategy:**

1. **Pull requests:** Run `stacksmith:build` to validate, and `stacksmith:plan` against staging to preview changes
2. **Merge to main:** Automatically `stacksmith:apply` to staging
3. **Production deploys:** Run `stacksmith:apply` against production manually or with a separate approval step

**Environment variables for token resolution:**

| Variable | Description |
|----------|-------------|
| `CS_AUTHTOKEN` | Contentstack management token |
| `CONTENTSTACK_MANAGEMENT_TOKEN` | Alternative management token variable |

---

## Troubleshooting

### Common Errors

**"--stack is required for apply."**

The `stacksmith:apply` command requires the `--stack` flag to identify which Contentstack stack to modify.

```bash
csdx stacksmith:apply --stack <your-stack-api-key> --token-alias <your-alias>
```

**"A management token alias is required for apply."**

The apply command needs a management token to authenticate with the Contentstack API. Provide one via `--token-alias`, CLI config, or the `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN` environment variable.

**"Build completed with blocking validation findings."**

Your schema has structural errors that must be fixed before proceeding. Run `csdx stacksmith:build --json` to see the full list of findings. Common causes:

- Duplicate entity UIDs (two content types or global fields with the same UID)
- Duplicate field UIDs within a single entity
- Reference field pointing to a content type that doesn't exist in your schema
- Global field reference pointing to a global field that doesn't exist in your schema

**"Apply aborted because the plan contains blocked changes."**

The plan includes destructive or breaking changes that are not allowed in Phase 1. Review the plan output to see which operations are blocked. Common blocked operations:

- Deleting a content type or global field
- Removing a field from an existing content type
- Changing a field's type (e.g., text → number)
- Changing a reference field's target content types
- Making an optional field required

To proceed, either remove the blocked changes from your definitions or handle them manually through the Contentstack dashboard.

**"Duplicate definition detected for {entityType}:{uid}."**

Two model definitions share the same entity type and UID. Each content type and global field must have a unique UID within its entity type. Check your model files for duplicate UIDs.

**"Import target already contains import-managed model files."**

`stacksmith:import` refuses to overwrite files from a prior import. Re-run with `--force` to refresh them, which deletes the previously tracked managed files before regenerating.

**"Cannot safely refresh existing generated files because no prior import manifest was found."**

The target directory has import-managed files but no `.contentstack/models/import-manifest.json` to describe them. The command won't delete files it can't prove it created. Either restore the manifest, delete the generated files manually, or import into a fresh directory.

**"Imported models did not reach parity with the source stack."**

The generated DSL, after `stacksmith:build`, still differs from the source stack. This is typically caused by a CMA field property the pipeline doesn't cover yet; the error message lists `residualCategories` (`unsupported field mapping`, `metadata mismatch`, `generator mismatch`) to help localize the drift. Re-run with `--json` to get the full diff payload.

**`ERR_PNPM_FETCH_404` after `pnpm install` in a freshly-imported package**

The generated `package.json` pins a concrete version for `@timbenniks/contentstack-stacksmith`. Inside a pnpm workspace, `pnpm install` expects `workspace:*`. `stacksmith:import` detects this by walking up from `--cwd` looking for `pnpm-workspace.yaml`, a `package.json` with `workspaces`, or `lerna.json`, and switches the dependency to `workspace:*` automatically. If the monorepo marker lives outside the walk path, edit the dependency manually.

---

### Validation Codes Reference

| Code | Level | Description |
|------|-------|-------------|
| `DUPLICATE_UID` | blocker | Two entities or fields share the same UID |
| `MISSING_REFERENCE_TARGET` | blocker | A reference field points to a content type not defined in the schema |
| `MISSING_GLOBAL_FIELD` | blocker | A `global_field` field, OR a modular block that uses `globalFieldRef`, points at a global field UID that isn't defined in the schema |
| `EMPTY_MODULAR_BLOCKS` | medium | A modular_blocks field has no blocks defined |
| `DESTRUCTIVE_CHANGE` | blocker | An operation that would delete an entity or remove a field |
| `BREAKING_FIELD_MUTATION` | blocker | A field update that changes the field type, reference targets, or tightens required validation |
| `RISKY_REQUIRED_FIELD` | high | A new required field is being added to an existing entity |
| `SAFE_FIELD_UPDATE` | low | A non-breaking field update (display name, description, etc.) |
| `SAFE_ADDITIVE_CHANGE` | low | A new optional field is being added |
| `SAFE_ENTITY_CHANGE` | low | A new entity is being created, or entity metadata is being updated |
| `PLAN_BLOCKED` | blocker | The overall plan contains one or more blocked operations |
| `HIGH_RISK_OPERATIONS` | high | The overall plan contains one or more high-risk operations |

---

## Advanced Patterns

Since models are plain TypeScript, you can use standard language features for composition and reuse.

### Shared Field Sets

Extract common fields into reusable arrays:

```typescript
import { text, date } from "@timbenniks/contentstack-stacksmith";

const timestampFields = [
  date("created_at", { required: true }),
  date("updated_at"),
];

const seoFields = [
  text("meta_title"),
  text("meta_description"),
  text("og_image"),
];

// Use in content types via spread
defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("body"),
    ...seoFields,
    ...timestampFields,
  ],
});
```

### Factory Functions

Create helper functions for common content type patterns:

```typescript
import { defineContentType, text, date, reference, globalField } from "@timbenniks/contentstack-stacksmith";

const createPageType = (
  uid: string,
  title: string,
  fields: FieldDefinition[],
) =>
  defineContentType(uid, {
    title,
    fields: [
      text("title", { required: true }),
      text("slug", { required: true, unique: true }),
      ...fields,
      globalField("seo", { ref: "seo" }),
    ],
    options: { is_page: true },
  });

// Usage
const landingPage = createPageType("landing_page", "Landing Page", [
  text("hero_heading"),
  text("hero_cta"),
]);

const productPage = createPageType("product_page", "Product Page", [
  reference("product", { to: ["product"] }),
  text("custom_description"),
]);
```

### Conditional Fields

Use environment variables or configuration to vary schemas:

```typescript
const debugFields = process.env.NODE_ENV === "development"
  ? [json("debug_data", { description: "Development only" })]
  : [];

defineContentType("article", {
  title: "Article",
  fields: [
    text("title", { required: true }),
    text("body"),
    ...debugFields,
  ],
});
```

### Multi-File Organization

Structure large projects with one file per entity:

```
src/models/
├── index.ts                    # Registry barrel
├── shared/
│   ├── seo-fields.ts           # Shared field sets
│   └── timestamp-fields.ts
├── content-types/
│   ├── blog-post.ts
│   ├── author.ts
│   └── page.ts
└── global-fields/
    └── seo.ts
```

Each file exports a single definition, and `index.ts` assembles the registry:

```typescript
// src/models/index.ts
import { defineModels } from "@timbenniks/contentstack-stacksmith";
import blogPost from "./content-types/blog-post";
import author from "./content-types/author";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [blogPost, author],
  globalFields: [seo],
});
```

---

## Best Practices

### File Organization

- **One entity per file.** Keep each content type and global field in its own file for clean diffs, easy navigation, and simple imports.
- **Separate directories** for content types (`content-types/`) and global fields (`global-fields/`).
- **Barrel file** (`index.ts`) that imports everything and exports a single `defineModels` call.

### Naming Conventions

- Use **`snake_case`** for all UIDs (`blog_post`, `meta_title`, `is_featured`). This matches Contentstack's internal conventions.
- Use descriptive UIDs that reflect the content they hold. Prefer `publish_date` over `date1`.
- Titles are auto-generated from UIDs if you don't provide them, so choose UIDs that read well when converted (`meta_title` → "Meta Title").

### Field Configuration

- **Mark non-translatable fields with `nonLocalizable: true`**. Slugs, URLs, SKUs, IDs, timestamps, and numeric settings usually shouldn't translate per-locale. Setting `nonLocalizable` makes the CMS show a single value across locales instead of forcing editors to translate them.
- **Reuse global fields as modular blocks** when the same block schema repeats across content types. Define the schema once as a `defineGlobalField(...)`, then reference it inside `modularBlocks({ blocks: [{ uid, title, globalFieldRef: "..." }] })`. Future edits to the global field propagate to every block that embeds it.
- **Use enum advanced mode** (`advanced: true` with `{ key, value }` pairs) when the editor-facing label differs from the stored value — e.g., `{ key: "United States", value: "US" }`.

### Version Control

- **Commit your model definitions** to Git. This is the primary benefit — content model changes become reviewable, auditable, and reversible.
- **Consider committing `schema.json`** to make diffs visible in pull requests without running a build. The deterministic output ensures no false positives.
- **Add `.contentstack/models/plan.json`** and **`diff.json`** to `.gitignore` — these are ephemeral artifacts specific to a point-in-time comparison.

### Safety

- **Always run `stacksmith:plan` before `stacksmith:apply`** to preview changes and check for blocked operations.
- **Use `--json` in CI pipelines** for machine-readable output that can be parsed by downstream tools.
- **Start small.** Deploy a few content types first, verify they look correct in the Contentstack dashboard, then expand.
- **Handle blocked operations manually** through the Contentstack dashboard when you need to make destructive changes (Phase 1 limitation).

### Team Workflow

- **Review model changes in PRs** just like code changes. The TypeScript definitions are readable and the compiled `schema.json` diffs clearly.
- **Use a staging stack** for testing model changes before applying to production.
- **Coordinate with content editors** when adding required fields or changing content types that have existing entries.
