import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("category", {
  title: "Category",
  description: "Blog post category.",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    text("description"),
  ],
});
