# Review Checklist

Every rule the review skill checks, with rationale and examples.

---

## Naming rules

### R-NAME-01: UIDs must be snake_case

**Severity:** Error

UIDs must use `snake_case`. The DSL and CMA enforce this convention.

Bad:
```ts
text("blogTitle")        // camelCase
text("blog-title")       // kebab-case
text("BlogTitle")        // PascalCase
```

Good:
```ts
text("blog_title")
```

### R-NAME-02: Content type UIDs should be singular

**Severity:** Suggestion

Use singular nouns for content type UIDs. Contentstack entries are individual items.

Bad:
```ts
defineContentType("blog_posts", { ... })
defineContentType("authors", { ... })
```

Good:
```ts
defineContentType("blog_post", { ... })
defineContentType("author", { ... })
```

### R-NAME-03: Avoid ambiguous or generic UIDs

**Severity:** Suggestion

Field UIDs should describe the data, not just the type.

Bad:
```ts
text("text1")
text("string_value")
number("num")
```

Good:
```ts
text("subtitle")
text("company_name")
number("price")
```

---

## Required field rules

### R-REQ-01: Content types should have at least one required field

**Severity:** Warning

A content type with no required fields allows empty entries, which is rarely intentional.

Bad:
```ts
defineContentType("author", {
  fields: [
    text("name"),
    text("bio"),
  ],
})
```

Good:
```ts
defineContentType("author", {
  fields: [
    text("name", { required: true }),
    text("bio"),
  ],
})
```

### R-REQ-02: Title/name fields should be required

**Severity:** Warning

Fields named `title`, `name`, or `heading` are typically the primary identifier and should be required.

### R-REQ-03: Slug fields should be required and unique

**Severity:** Warning

Fields named `slug` or `url_slug` are used for URL routing and must be unique to prevent collisions.

Bad:
```ts
text("slug")
```

Good:
```ts
text("slug", { required: true, unique: true })
```

---

## Reference rules

### R-REF-01: Reference targets must exist in the registry

**Severity:** Error

Every UID in a `reference({ to: [...] })` must correspond to a content type in `defineModels()`. This is also caught by `stacksmith:build`.

### R-REF-02: Avoid overly broad references

**Severity:** Warning

References that target more than 3 content types make content editing confusing and queries complex.

Bad:
```ts
reference("content", { to: ["blog_post", "page", "author", "category", "tag", "product"] })
```

Good:
```ts
reference("content", { to: ["blog_post", "page"] })
```

### R-REF-03: Self-references should be intentional

**Severity:** Suggestion

A content type referencing itself (e.g., `category` → `category`) is valid for hierarchies but should be explicitly intentional.

```ts
// Valid: hierarchical categories
reference("parent_category", { to: ["category"] })
```

### R-REF-04: Watch for circular reference chains

**Severity:** Warning

If type A references type B and type B references type A, queries may loop. This is sometimes intentional (e.g., author ↔ blog_post) but should be flagged for review.

---

## Global field rules

### R-GF-01: Duplicated field groups should be global fields

**Severity:** Suggestion

If 2+ content types share the same set of fields (matching UIDs and types), they should be extracted into a global field.

Common candidates:
- SEO fields (`meta_title`, `meta_description`, `og_image`)
- CTA fields (`label`, `url`)
- Address fields (`street`, `city`, `state`, `zip_code`)
- Social link fields (`twitter_url`, `linkedin_url`, `github_url`)

### R-GF-02: Unused global fields should be removed

**Severity:** Warning

A global field defined in the registry but not referenced by any content type via `globalField()` is dead code.

### R-GF-03: Global field refs must exist in the registry

**Severity:** Error

Every `globalField({ ref: "uid" })` must correspond to a global field in `defineModels()`. This is also caught by `stacksmith:build`.

---

## Structure rules

### R-STRUCT-01: Content types with 20+ fields may be too complex

**Severity:** Suggestion

Large content types are hard to manage for both developers and content editors. Consider:
- Grouping related fields with `group()`
- Extracting reusable groups into global fields
- Splitting into multiple content types with references

### R-STRUCT-02: Single-block modular blocks should be groups

**Severity:** Suggestion

A `modularBlocks()` field with only one block definition offers no flexibility advantage over a `group()`.

Bad:
```ts
modularBlocks("content", {
  blocks: [
    { uid: "text", title: "Text", fields: [json("body")] },
  ],
})
```

Good:
```ts
group("content", {
  fields: [json("body")],
})
```

### R-STRUCT-02a: Prefer `globalFieldRef` blocks for reusable schemas

**Severity:** Suggestion

When the same block schema repeats across content types, extract it into a global field and reference it with `globalFieldRef` instead of re-declaring inline fields. This keeps the block schema single-sourced and makes future edits apply everywhere.

Bad (same fields declared in three content types):
```ts
modularBlocks("sections", {
  blocks: [
    { uid: "hero", title: "Hero", fields: [text("heading"), text("subheading")] },
  ],
})
```

Good:
```ts
// global-fields/hero.ts — single source of truth
export default defineGlobalField("hero", {
  title: "Hero",
  fields: [text("heading"), text("subheading")],
});

// content-types/*.ts
modularBlocks("sections", {
  blocks: [
    { uid: "hero", title: "Hero", globalFieldRef: "hero" },
  ],
})
```

### R-FIELD-NL: Set `nonLocalizable` on fields that shouldn't translate

**Severity:** Warning

Fields like IDs, slugs, URLs, SKUs, timestamps, and numeric settings usually shouldn't be translated. Set `nonLocalizable: true` on them so the CMS shows a single value across locales instead of forcing editors to translate them.

Bad:
```ts
text("slug", { required: true, unique: true })
```

Good:
```ts
text("slug", { required: true, unique: true, nonLocalizable: true })
```

### R-STRUCT-03: Avoid deeply nested groups

**Severity:** Warning

Groups nested 3+ levels deep are hard to query and edit. Consider flattening.

Bad:
```ts
group("level1", {
  fields: [
    group("level2", {
      fields: [
        group("level3", {
          fields: [text("value")],
        }),
      ],
    }),
  ],
})
```

### R-STRUCT-04: Singleton misuse

**Severity:** Warning

Singleton content types allow only one entry. They're appropriate for site settings, navigation, and footer — not for regular content like articles or products.

---

## Completeness rules

### R-COMP-01: Entities should have descriptions

**Severity:** Suggestion

Descriptions help content editors understand the purpose of a content type or global field.

Bad:
```ts
defineContentType("page", {
  fields: [...],
})
```

Good:
```ts
defineContentType("page", {
  description: "A standalone page with flexible content sections.",
  fields: [...],
})
```

### R-COMP-02: Non-obvious fields should have descriptions

**Severity:** Suggestion

Fields whose purpose isn't clear from the name alone benefit from a `description` option.

```ts
text("canonical_url", { description: "Override the default canonical URL for SEO." })
boolean("no_index", { description: "Prevent search engines from indexing this page.", defaultValue: false })
```
