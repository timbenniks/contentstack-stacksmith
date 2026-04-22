# Common Modeling Patterns

Reusable patterns for common Contentstack model architectures.

---

## Shared global fields

### SEO metadata

```ts
export default defineGlobalField("seo", {
  title: "SEO",
  fields: [
    text("meta_title"),
    text("meta_description"),
    text("og_image"),
    text("canonical_url"),
    boolean("no_index", { defaultValue: false }),
  ],
});
```

### Hero banner

```ts
export default defineGlobalField("hero", {
  title: "Hero Banner",
  fields: [
    text("heading", { required: true }),
    text("subheading"),
    text("image_url"),
    group("cta", {
      fields: [
        text("label"),
        text("url"),
      ],
    }),
  ],
});
```

### Social links

```ts
export default defineGlobalField("social_links", {
  title: "Social Links",
  fields: [
    text("twitter_url"),
    text("linkedin_url"),
    text("github_url"),
    text("website_url"),
  ],
});
```

---

## Blog / editorial

### Author

```ts
export default defineContentType("author", {
  title: "Author",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    json("bio"),
    text("avatar_url"),
    globalField("social_links", { ref: "social_links" }),
  ],
});
```

### Blog post

```ts
export default defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    text("excerpt"),
    json("body", { required: true }),
    text("featured_image"),
    date("publish_date"),
    reference("author", { to: ["author"], required: true }),
    reference("categories", { to: ["category"], multiple: true }),
    reference("tags", { to: ["tag"], multiple: true }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

### Category and tag

```ts
export default defineContentType("category", {
  title: "Category",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("description"),
  ],
});

export default defineContentType("tag", {
  title: "Tag",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
  ],
});
```

---

## Page builder

### Page with modular blocks

```ts
export default defineContentType("page", {
  title: "Page",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    globalField("seo", { ref: "seo" }),
    modularBlocks("sections", {
      blocks: [
        {
          uid: "hero",
          title: "Hero",
          fields: [
            text("heading", { required: true }),
            text("subheading"),
            text("background_image"),
            group("cta", {
              fields: [
                text("label", { required: true }),
                text("url", { required: true }),
              ],
            }),
          ],
        },
        {
          uid: "text_content",
          title: "Text Content",
          fields: [
            text("heading"),
            json("body", { required: true }),
          ],
        },
        {
          uid: "image_gallery",
          title: "Image Gallery",
          fields: [
            text("heading"),
            json("images", { multiple: true }),
          ],
        },
        {
          uid: "cta_strip",
          title: "CTA Strip",
          fields: [
            text("heading", { required: true }),
            text("description"),
            text("button_label", { required: true }),
            text("button_url", { required: true }),
          ],
        },
        {
          uid: "featured_content",
          title: "Featured Content",
          fields: [
            text("heading"),
            reference("items", { to: ["blog_post", "page"], multiple: true }),
          ],
        },
      ],
    }),
  ],
});
```

---

## E-commerce

### Product

```ts
export default defineContentType("product", {
  title: "Product",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("sku", { required: true, unique: true }),
    json("description"),
    number("price", { required: true }),
    number("compare_at_price"),
    boolean("in_stock", { defaultValue: true }),
    enumField("status", {
      choices: ["draft", "active", "archived"],
      defaultValue: "draft",
    }),
    reference("category", { to: ["product_category"], required: true }),
    reference("related_products", { to: ["product"], multiple: true }),
    group("dimensions", {
      fields: [
        number("weight"),
        number("width"),
        number("height"),
        number("depth"),
      ],
    }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

### Product category

```ts
export default defineContentType("product_category", {
  title: "Product Category",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("description"),
    text("image_url"),
    reference("parent_category", { to: ["product_category"] }),
  ],
});
```

---

## Navigation and settings

### Navigation menu

```ts
export default defineContentType("navigation", {
  title: "Navigation",
  options: { singleton: true },
  fields: [
    text("title", { required: true }),
    group("items", {
      multiple: true,
      fields: [
        text("label", { required: true }),
        text("url", { required: true }),
        group("children", {
          multiple: true,
          fields: [
            text("label", { required: true }),
            text("url", { required: true }),
          ],
        }),
      ],
    }),
  ],
});
```

### Site settings (singleton)

```ts
export default defineContentType("site_settings", {
  title: "Site Settings",
  options: { singleton: true },
  fields: [
    text("site_name", { required: true }),
    text("tagline"),
    text("logo_url"),
    text("favicon_url"),
    globalField("social_links", { ref: "social_links" }),
    group("footer", {
      fields: [
        text("copyright_text"),
        json("footer_links"),
      ],
    }),
  ],
});
```

---

## Pattern tips

### When to use global fields

Use global fields when:
- The same set of fields appears in 2+ content types (e.g., SEO, social links).
- You want a single source of truth for field definitions.
- Changes to the field group should propagate to all content types that use it.

### When to use groups vs global fields

- **Group**: inline field grouping within a single content type. Good for one-off structured data.
- **Global field**: reusable field group shared across content types. Good for repeated patterns.

### When to use modular blocks

Use modular blocks when:
- Content editors need flexible, mix-and-match page sections.
- The order and combination of blocks varies per entry.
- You want structured, typed blocks instead of freeform JSON.

### Reference strategies

- **Single reference**: `reference("author", { to: ["author"] })` — one-to-one relationship.
- **Multi-reference**: `reference("tags", { to: ["tag"], multiple: true })` — one-to-many.
- **Polymorphic reference**: `reference("content", { to: ["blog_post", "page", "product"] })` — can point to multiple content types.
- **Self-reference**: `reference("parent", { to: ["category"] })` inside `category` — for hierarchical structures.
