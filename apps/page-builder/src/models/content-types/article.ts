import {
  date,
  enumField,
  file,
  jsonRte,
  reference,
  taxonomy,
  text,
} from "@timbenniks/contentstack-stacksmith";
import { createPageType } from "../shared/page-factory";

export default createPageType("article", "Article", [
  text("subtitle"),
  file("featured_image", { required: true }),
  jsonRte("body", {
    required: true,
    richTextType: "advanced",
    referenceTo: ["article"],
  }),
  reference("author", { to: ["author"] }),
  taxonomy("topics", {
    taxonomies: [{ taxonomy_uid: "topics", max_terms: 5 }],
  }),
  date("published_at"),
  enumField("status", {
    choices: ["draft", "review", "published", "archived"],
    displayType: "dropdown",
  }),
]);
