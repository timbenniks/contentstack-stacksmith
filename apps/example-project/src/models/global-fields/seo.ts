import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  description: "SEO metadata reused across content types.",
  fields: [
    text("meta_title"),
    text("meta_description"),
  ],
});
