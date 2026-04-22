import { defineContentType, text, file, markdown, link, group } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  description: "Content author profile.",
  fields: [
    text("name", { required: true }),
    text("slug", { required: true, unique: true }),
    file("avatar"),
    text("role"),
    markdown("bio"),
    group("social_links", {
      fields: [
        link("twitter"),
        link("linkedin"),
        link("github"),
      ],
    }),
  ],
});
