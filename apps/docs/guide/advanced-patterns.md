# Advanced Patterns

Since models are plain TypeScript, you can use standard language features for composition and reuse.

## Shared field sets

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

## Factory functions

Create helper functions for common content type patterns:

```typescript
import { defineContentType, text, date, reference, globalField } from "@timbenniks/contentstack-stacksmith";
import type { FieldDefinition } from "@timbenniks/contentstack-stacksmith";

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

## Conditional fields

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

## Multi-file organization

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

## Reusing global fields as modular blocks

When the same block schema appears in multiple content types, extract it into a global field and reference it from each `modularBlocks` usage:

```typescript
// src/models/global-fields/cta.ts
export default defineGlobalField("cta", {
  title: "Call to Action",
  fields: [
    text("label", { required: true }),
    text("url", { required: true }),
  ],
});

// src/models/content-types/page.ts
modularBlocks("sections", {
  blocks: [
    { uid: "hero", title: "Hero", fields: [text("heading")] },
    { uid: "cta_banner", title: "CTA Banner", globalFieldRef: "cta" },
  ],
})

// src/models/content-types/landing-page.ts — the same block, reusing cta
modularBlocks("sections", {
  blocks: [
    { uid: "hero", title: "Hero", fields: [text("headline"), text("video_url")] },
    { uid: "cta_banner", title: "CTA Banner", globalFieldRef: "cta" },
  ],
})
```

Future edits to `cta` propagate to every block that references it. No duplicated inline schemas.
