# E-commerce Product Catalog

A product catalog with categories, enum fields, and grouped nested fields.

## `src/models/content-types/category.ts`

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

## `src/models/content-types/product.ts`

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
    text("sku", { required: true, unique: true, nonLocalizable: true }),
    number("stock_quantity", { defaultValue: 0, nonLocalizable: true }),
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

## `src/models/index.ts`

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import category from "./content-types/category";
import product from "./content-types/product";

export default defineModels({
  contentTypes: [category, product],
});
```

## Notes

- The `sku` and `stock_quantity` fields use `nonLocalizable: true` because they shouldn't vary by locale — one SKU and one inventory count per product, regardless of language.
- The `dimensions` group nests physical attributes together so the UI renders them as a single fieldset.
- `pricing_tiers` has `multiple: true`, turning it into a repeating group that editors can add rows to.
