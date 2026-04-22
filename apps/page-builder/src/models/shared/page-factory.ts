import {
  defineContentType,
  globalField,
  text,
} from "@timbenniks/contentstack-stacksmith";
import type { ContentTypeDefinition, FieldDefinition } from "@timbenniks/contentstack-stacksmith";

export const createPageType = (
  uid: string,
  title: string,
  fields: FieldDefinition[],
  options: { singleton?: boolean } = {},
): ContentTypeDefinition =>
  defineContentType(uid, {
    title,
    fields: [
      text("title", { required: true }),
      text("slug", { required: true, unique: true }),
      ...fields,
      globalField("seo", { ref: "seo" }),
    ],
    options: {
      is_page: true,
      singleton: options.singleton ?? false,
    },
  });
