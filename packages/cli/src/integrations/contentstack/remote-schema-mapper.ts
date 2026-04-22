import {
  normalizeSchema,
  type CompiledEntity,
  type CompiledField,
  type EnumChoiceAdvanced,
  type NormalizableFieldInput,
  type SchemaArtifact,
} from "@timbenniks/contentstack-stacksmith";

type ContentstackField = Record<string, any>;

const resolveFieldKind = (field: ContentstackField): CompiledField["kind"] => {
  // Several Contentstack features are encoded as flags on a base data_type,
  // so detect those richer variants before falling back to the raw type map.
  if (field.data_type === "text" && Array.isArray(field.enum?.choices) && field.enum.choices.length > 0) return "enum";
  if (field.data_type === "text" && field.field_metadata?.allow_rich_text) return "rich_text";
  if (field.data_type === "text" && field.field_metadata?.markdown) return "markdown";
  if (field.data_type === "json" && field.field_metadata?.allow_json_rte) return "json_rte";

  const kindMap: Record<string, CompiledField["kind"]> = {
    text: "text",
    number: "number",
    boolean: "boolean",
    isodate: "date",
    json: "json",
    file: "file",
    link: "link",
    reference: "reference",
    group: "group",
    blocks: "modular_blocks",
    global_field: "global_field",
    taxonomy: "taxonomy",
  };

  return kindMap[field.data_type] ?? "text";
};

const extractFieldMetadata = (field: ContentstackField): Record<string, unknown> => {
  const metadata = { ...(field.field_metadata ?? {}) };
  delete metadata.description;
  delete metadata.multiline;
  delete metadata.markdown;
  delete metadata.allow_rich_text;
  delete metadata.allow_json_rte;
  delete metadata.rich_text_type;
  delete metadata.ref_multiple_content_types;
  return metadata;
};

const extractErrorMessages = (field: ContentstackField): Record<string, string> | undefined => {
  const raw = field.error_messages;
  if (!raw || typeof raw !== "object") return undefined;

  const entries = Object.entries(raw).filter(
    ([, value]) => typeof value === "string" && value.length > 0,
  ) as Array<[string, string]>;

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const extractEnumChoices = (
  field: ContentstackField,
): { choices: string[] | EnumChoiceAdvanced[] | undefined; advanced: boolean } => {
  if (!Array.isArray(field.enum?.choices)) return { choices: undefined, advanced: false };

  const advanced = field.enum?.advanced === true;
  if (advanced) {
    const pairs = field.enum.choices.map((choice: { key?: string; value?: string }) => ({
      key: typeof choice?.key === "string" ? choice.key : String(choice?.value ?? ""),
      value: typeof choice?.value === "string" ? choice.value : "",
    }));
    return { choices: pairs, advanced: true };
  }

  const plain = field.enum.choices.map((choice: string | { value?: string }) =>
    typeof choice === "string" ? choice : choice?.value ?? "",
  );
  return { choices: plain, advanced: false };
};

const mapField = (field: ContentstackField): NormalizableFieldInput => {
  const kind = resolveFieldKind(field);
  const multiple =
    // Contentstack treats these as multi-value by default when the flag is omitted,
    // unlike most other field kinds where the safe default is false.
    kind === "modular_blocks" || kind === "taxonomy"
      ? field.multiple ?? true
      : Boolean(field.multiple);
  const richTextType =
    kind === "rich_text" || kind === "json_rte"
      ? field.field_metadata?.rich_text_type ?? "advanced"
      : undefined;
  const description = field.field_metadata?.description || undefined;
  const nonLocalizable = field.non_localizable ? true : undefined;
  const errorMessages = extractErrorMessages(field);
  const { choices: enumChoices, advanced: enumAdvanced } = extractEnumChoices(field);
  const minInstance = kind === "enum" && typeof field.min_instance === "number" ? field.min_instance : undefined;
  const maxInstance = kind === "enum" && typeof field.max_instance === "number" ? field.max_instance : undefined;
  const plugins =
    kind === "json_rte" && Array.isArray(field.plugins) && field.plugins.length > 0
      ? field.plugins
      : undefined;
  const extensions =
    kind === "file" && Array.isArray(field.extensions) && field.extensions.length > 0
      ? field.extensions
      : undefined;
  const refMultipleContentTypes =
    kind === "reference" && typeof field.field_metadata?.ref_multiple_content_types === "boolean"
      ? field.field_metadata.ref_multiple_content_types
      : undefined;

  return {
    uid: field.uid,
    displayName: field.display_name ?? field.uid,
    kind,
    required: Boolean(field.mandatory),
    unique: Boolean(field.unique),
    multiple,
    nonLocalizable,
    description,
    defaultValue: field.default_value,
    metadata: extractFieldMetadata(field),
    referenceTo: kind === "json_rte" ? field.reference_to : (kind === "reference" ? field.reference_to : undefined),
    refMultipleContentTypes,
    globalFieldRef: typeof field.reference_to === "string" ? field.reference_to : undefined,
    enumChoices,
    enumAdvanced: enumAdvanced ? true : undefined,
    minInstance,
    maxInstance,
    richTextType,
    plugins,
    taxonomies: Array.isArray(field.taxonomies) ? field.taxonomies : undefined,
    format: field.format || undefined,
    errorMessages,
    multiline: field.field_metadata?.multiline ? true : undefined,
    displayType: field.display_type,
    startDate: field.startDate,
    endDate: field.endDate,
    extensions,
    fields: Array.isArray(field.schema) ? field.schema.map(mapField) : undefined,
    blocks: Array.isArray(field.blocks)
      ? field.blocks.map((block: { uid: string; title?: string; schema?: ContentstackField[]; reference_to?: string }) => {
          if (typeof block.reference_to === "string") {
            return {
              uid: block.uid,
              title: block.title ?? block.uid,
              globalFieldRef: block.reference_to,
            };
          }

          return {
            uid: block.uid,
            title: block.title ?? block.uid,
            fields: (block.schema ?? []).map(mapField),
          };
        })
      : undefined,
  };
};

const mapEntity = (kind: "content_type" | "global_field", payload: Record<string, any>): CompiledEntity => ({
  kind,
  uid: payload.uid,
  title: payload.title,
  description: payload.description,
  metadata: { origin: "remote" },
  fields: (payload.schema ?? []).map(mapField),
  ...(kind === "content_type" ? { options: payload.options ?? {} } : {}),
  id: "",
  dependencies: [],
});

const fieldToContentstack = (field: CompiledField): Record<string, any> => {
  const common: Record<string, any> = {
    display_name: field.displayName,
    uid: field.uid,
    mandatory: field.required,
    unique: field.unique,
    multiple: field.multiple,
    field_metadata: {
      ...(field.description ? { description: field.description } : {}),
      ...(field.multiline ? { multiline: true } : {}),
      ...field.metadata,
    },
  };

  if (field.nonLocalizable) common.non_localizable = true;
  if (field.format) common.format = field.format;
  if (field.errorMessages && Object.keys(field.errorMessages).length > 0) {
    common.error_messages = { ...field.errorMessages };
  }
  if (field.startDate !== undefined) common.startDate = field.startDate;
  if (field.endDate !== undefined) common.endDate = field.endDate;

  switch (field.kind) {
    case "date":
      return { ...common, data_type: "isodate" };
    case "file":
      return {
        ...common,
        data_type: "file",
        ...(field.extensions && field.extensions.length > 0 ? { extensions: field.extensions } : {}),
      };
    case "link":
      return { ...common, data_type: "link" };
    case "markdown":
      return { ...common, data_type: "text", field_metadata: { ...common.field_metadata, markdown: true } };
    case "rich_text":
      return { ...common, data_type: "text", field_metadata: { ...common.field_metadata, allow_rich_text: true, rich_text_type: field.richTextType ?? "advanced" } };
    case "json_rte":
      return {
        ...common,
        data_type: "json",
        field_metadata: { ...common.field_metadata, allow_json_rte: true, rich_text_type: field.richTextType ?? "advanced" },
        reference_to: field.referenceTo ?? [],
        ...(field.plugins && field.plugins.length > 0 ? { plugins: field.plugins } : {}),
      };
    case "taxonomy":
      return { ...common, data_type: "taxonomy", taxonomies: field.taxonomies ?? [] };
    case "reference":
      return {
        ...common,
        data_type: "reference",
        reference_to: field.referenceTo ?? [],
        ...(field.refMultipleContentTypes !== undefined
          ? { field_metadata: { ...common.field_metadata, ref_multiple_content_types: field.refMultipleContentTypes } }
          : {}),
      };
    case "global_field":
      return { ...common, data_type: "global_field", reference_to: field.globalFieldRef };
    case "enum": {
      const choices = field.enumChoices ?? [];
      const isAdvanced = field.enumAdvanced === true;
      return {
        ...common,
        data_type: "text",
        ...(field.displayType ? { display_type: field.displayType } : {}),
        ...(field.minInstance !== undefined ? { min_instance: field.minInstance } : {}),
        ...(field.maxInstance !== undefined ? { max_instance: field.maxInstance } : {}),
        enum: {
          ...(isAdvanced ? { advanced: true } : {}),
          choices: isAdvanced
            ? (choices as EnumChoiceAdvanced[]).map((choice) => ({ key: choice.key, value: choice.value }))
            : (choices as string[]).map((choice) => ({ value: choice })),
        },
      };
    }
    case "group":
      return {
        ...common,
        data_type: "group",
        schema: (field.fields ?? []).map(fieldToContentstack),
      };
    case "modular_blocks":
      return {
        ...common,
        data_type: "blocks",
        blocks: (field.blocks ?? []).map((block) =>
          block.globalFieldRef
            ? {
                uid: block.uid,
                title: block.title,
                reference_to: block.globalFieldRef,
              }
            : {
                uid: block.uid,
                title: block.title,
                schema: (block.fields ?? []).map(fieldToContentstack),
              },
        ),
      };
    default:
      return { ...common, data_type: field.kind };
  }
};

export class RemoteSchemaMapper {
  toSchemaArtifact(contentTypes: Record<string, any>[], globalFields: Record<string, any>[]): SchemaArtifact {
    return normalizeSchema({
      entities: [
        ...contentTypes.map((contentType) => mapEntity("content_type", contentType)),
        ...globalFields.map((globalField) => mapEntity("global_field", globalField)),
      ],
      metadata: { origin: "remote" },
    });
  }

  toContentstackEntity(entity: CompiledEntity): Record<string, any> {
    // Rebuild the CMA envelope shape so downstream tooling can consume locally
    // compiled entities as if they had been fetched from Contentstack.
    const base = {
      title: entity.title,
      uid: entity.uid,
      schema: entity.fields.map(fieldToContentstack),
    };

    if (entity.kind === "content_type") {
      return { content_type: { ...base, options: (entity as CompiledEntity & { options?: Record<string, unknown> }).options ?? {} } };
    }

    return { global_field: base };
  }
}
