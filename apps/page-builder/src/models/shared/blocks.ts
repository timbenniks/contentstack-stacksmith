import {
  boolean,
  enumField,
  file,
  group,
  jsonRte,
  link,
  number,
  reference,
  richText,
  text,
} from "@timbenniks/contentstack-stacksmith";
import type { ModularBlockDefinition } from "@timbenniks/contentstack-stacksmith";

export const heroBlock: ModularBlockDefinition = {
  uid: "hero",
  title: "Hero Banner",
  fields: [
    text("heading", { required: true }),
    text("subheading"),
    file("background_image"),
    file("background_video"),
    link("cta_link"),
    text("cta_text"),
    enumField("layout", {
      choices: ["centered", "left_aligned", "right_aligned", "full_bleed"],
      displayType: "radio",
    }),
    boolean("overlay_text", { defaultValue: true }),
  ],
};

export const contentBlock: ModularBlockDefinition = {
  uid: "content",
  title: "Rich Content",
  fields: [
    jsonRte("body", {
      richTextType: "advanced",
      referenceTo: ["article", "product"],
    }),
  ],
};

export const imageGalleryBlock: ModularBlockDefinition = {
  uid: "image_gallery",
  title: "Image Gallery",
  fields: [
    text("gallery_title"),
    file("images", { multiple: true, required: true }),
    enumField("layout", {
      choices: ["grid", "masonry", "carousel", "lightbox"],
      displayType: "dropdown",
    }),
    number("columns", { defaultValue: 3 }),
  ],
};

export const testimonialBlock: ModularBlockDefinition = {
  uid: "testimonial",
  title: "Testimonial",
  fields: [
    richText("quote", { required: true }),
    text("author_name", { required: true }),
    text("author_role"),
    file("author_photo"),
    number("rating"),
  ],
};

export const ctaBlock: ModularBlockDefinition = {
  uid: "cta",
  title: "Call to Action",
  fields: [
    text("heading", { required: true }),
    text("description"),
    group("buttons", {
      fields: [
        text("label", { required: true }),
        link("url"),
        enumField("style", { choices: ["primary", "secondary", "outline"] }),
      ],
      multiple: true,
    }),
    file("background_image"),
  ],
};

export const featuredContentBlock: ModularBlockDefinition = {
  uid: "featured_content",
  title: "Featured Content",
  fields: [
    text("section_title"),
    reference("items", { to: ["article", "product"], multiple: true }),
    enumField("display_style", {
      choices: ["cards", "list", "carousel"],
      displayType: "dropdown",
    }),
    number("max_items", { defaultValue: 6 }),
  ],
};

export const videoBlock: ModularBlockDefinition = {
  uid: "video",
  title: "Video Embed",
  fields: [
    text("video_title"),
    text("video_url", {
      required: true,
      format: "^https?://",
      formatErrorMessage: "Must be a valid URL starting with http:// or https://",
    }),
    file("poster_image"),
    boolean("autoplay", { defaultValue: false }),
  ],
};
