import { defineContentType, globalField, reference, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  description: "Example post type that exercises reference and global field dependencies.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
