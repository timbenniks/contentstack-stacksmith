import { defineContentType, text, file, link, markdown } from "@timbenniks/contentstack-stacksmith";
import { slugField } from "../shared/common-fields";

export default defineContentType("brand", {
  title: "Brand",
  description: "Product brand with logo and description.",
  fields: [
    text("name", { required: true }),
    slugField,
    file("logo"),
    markdown("description"),
    link("website"),
  ],
});
