import {
  defineContentType,
  file,
  globalField,
  jsonRte,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";
import { slugField } from "../shared/common-fields";

export default defineContentType("collection", {
  title: "Collection",
  description: "Curated product collection with featured products.",
  fields: [
    text("name", { required: true }),
    slugField,
    jsonRte("description"),
    file("banner_image"),
    reference("featured_products", { to: ["product"], multiple: true }),
    globalField("seo", { ref: "seo" }),
  ],
});
