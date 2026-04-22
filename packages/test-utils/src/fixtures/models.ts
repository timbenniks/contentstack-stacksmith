import { compileDefinitions, defineContentType, defineGlobalField, globalField, reference, text } from "@timbenniks/contentstack-stacksmith";

export const authorModel = defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});

export const seoModel = defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});

export const blogPostModel = defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});

export const sampleSchema = compileDefinitions([authorModel, blogPostModel, seoModel]);
