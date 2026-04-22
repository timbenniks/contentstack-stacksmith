import {
  defineContentType,
  date,
  enumField,
  file,
  jsonRte,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("post", {
  title: "Post",
  description: "Blog post with rich content, author reference, and categories.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    text("excerpt", { multiline: true }),
    jsonRte("body", { required: true }),
    file("featured_image"),
    reference("author", { to: ["author"], required: true }),
    reference("categories", { to: ["category"], multiple: true }),
    date("published_at"),
    enumField("status", {
      choices: ["draft", "published", "archived"],
      displayType: "dropdown",
    }),
  ],
});
