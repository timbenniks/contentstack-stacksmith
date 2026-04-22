import { text, date } from "@timbenniks/contentstack-stacksmith";
import type { FieldDefinition } from "@timbenniks/contentstack-stacksmith";

export const slugField = text("slug", {
  required: true,
  unique: true,
  format: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
  formatErrorMessage: "Slug must be lowercase with hyphens only.",
});

export const timestampFields: FieldDefinition[] = [
  date("published_at"),
  date("expires_at"),
];
