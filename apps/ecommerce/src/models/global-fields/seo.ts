import { defineGlobalField, text, file } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  description: "Search engine optimization metadata.",
  fields: [
    text("meta_title"),
    text("meta_description", { multiline: true }),
    text("meta_keywords"),
    file("og_image"),
  ],
});
