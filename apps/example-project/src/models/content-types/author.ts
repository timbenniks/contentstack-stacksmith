import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  description: "Reusable author profile used by posts and references.",
  fields: [
    text("name", { required: true }),
    text("bio"),
  ],
});
