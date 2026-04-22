import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("address", {
  title: "Address",
  description: "Reusable postal address.",
  fields: [
    text("street"),
    text("city", { required: true }),
    text("state"),
    text("postal_code", { required: true }),
    text("country", { required: true }),
  ],
});
