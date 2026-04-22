import {
  defineContentType,
  boolean,
  enumField,
  file,
  globalField,
  group,
  json,
  jsonRte,
  number,
  reference,
  taxonomy,
  text,
} from "@timbenniks/contentstack-stacksmith";
import { slugField, timestampFields } from "../shared/common-fields";

export default defineContentType("product", {
  title: "Product",
  description: "E-commerce product with variants, pricing, and media.",
  fields: [
    text("name", { required: true }),
    slugField,
    jsonRte("description", { richTextType: "advanced" }),
    reference("brand", { to: ["brand"] }),
    number("price", { required: true }),
    number("compare_at_price"),
    enumField("currency", {
      choices: ["USD", "EUR", "GBP"],
      displayType: "dropdown",
    }),
    boolean("in_stock", { defaultValue: true }),
    file("main_image", { required: true }),
    file("gallery", { multiple: true }),
    group("dimensions", {
      fields: [
        number("weight"),
        number("width"),
        number("height"),
        number("depth"),
        text("unit", { defaultValue: "cm" }),
      ],
    }),
    json("custom_attributes", { description: "Arbitrary key-value product metadata." }),
    taxonomy("product_categories", {
      taxonomies: [
        { taxonomy_uid: "product_category", max_terms: 5 },
        { taxonomy_uid: "product_tag", max_terms: 10 },
      ],
    }),
    globalField("seo", { ref: "seo" }),
    ...timestampFields,
  ],
});
