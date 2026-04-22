import { defineGlobalField, text, file, boolean } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  description: "Search engine optimization metadata shared across all page types.",
  fields: [
    text("meta_title"),
    text("meta_description", { multiline: true }),
    file("og_image"),
    text("canonical_url"),
    boolean("noindex", { defaultValue: false }),
  ],
});
