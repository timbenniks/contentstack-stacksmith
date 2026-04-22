import {
  defineContentType,
  boolean,
  file,
  globalField,
  group,
  jsonRte,
  number,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("product", {
  title: "Product",
  description: "Product that can be referenced from page content blocks.",
  fields: [
    text("name", { required: true }),
    text("sku", { required: true, unique: true }),
    jsonRte("description"),
    number("price", { required: true }),
    file("image"),
    reference("related_products", { to: ["product"], multiple: true }),
    boolean("featured", { defaultValue: false }),
    group("specs", {
      fields: [
        text("key", { required: true }),
        text("value", { required: true }),
      ],
      multiple: true,
    }),
    globalField("seo", { ref: "seo" }),
  ],
});
