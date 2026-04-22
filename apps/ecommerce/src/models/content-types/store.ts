import {
  defineContentType,
  globalField,
  group,
  link,
  text,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("store", {
  title: "Store",
  description: "Physical store location.",
  fields: [
    text("name", { required: true }),
    globalField("address", { ref: "address" }),
    group("contact", {
      fields: [
        text("phone"),
        text("email", { format: "^[^@]+@[^@]+\\.[^@]+$", formatErrorMessage: "Must be a valid email." }),
        link("website"),
      ],
    }),
    group("hours", {
      fields: [
        text("weekday"),
        text("weekend"),
      ],
      multiple: true,
    }),
  ],
});
