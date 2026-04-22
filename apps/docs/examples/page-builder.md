# Page Builder with Modular Blocks

A flexible page builder using modular blocks for composable page layouts, plus a shared CTA global field — demonstrating both inline blocks and global-field-reference blocks.

## `src/models/global-fields/cta.ts`

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

## `src/models/content-types/page.ts`

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

## `src/models/index.ts`

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

## Inline vs. global-field-reference blocks

Five of the six blocks declare their fields inline: the block schema lives entirely inside the `modularBlocks` call. The last block, `cta_banner`, uses `globalFieldRef: "cta"` — it reuses the `cta` global field's schema directly. When you update `cta`, every `cta_banner` block across every page picks up the change with no edits in the page content type.

Use global-field-reference blocks when the same block schema appears in multiple content types. Use inline blocks when the schema is genuinely specific to one page type.
