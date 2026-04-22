import { defineContentType, text, file, markdown } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  description: "Blog author profile.",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    file("avatar"),
    markdown("bio"),
  ],
});
