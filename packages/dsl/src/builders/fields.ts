import type {
  BaseFieldOptions,
  BooleanFieldOptions,
  DateFieldDefinition,
  DateFieldOptions,
  EnumFieldDefinition,
  EnumFieldOptions,
  FieldDefinition,
  FileFieldDefinition,
  FileFieldOptions,
  GlobalFieldFieldDefinition,
  GlobalFieldFieldOptions,
  GroupFieldDefinition,
  GroupFieldOptions,
  JsonFieldOptions,
  JsonRteFieldDefinition,
  JsonRteFieldOptions,
  ModularBlocksFieldDefinition,
  ModularBlocksFieldOptions,
  NumberFieldOptions,
  PrimitiveFieldDefinition,
  ReferenceFieldDefinition,
  ReferenceFieldOptions,
  RichTextFieldDefinition,
  RichTextFieldOptions,
  TaxonomyFieldDefinition,
  TaxonomyFieldOptions,
  TextFieldDefinition,
  TextFieldOptions,
} from "../definitions/types.js";

const UID_PATTERN = /^[a-z][a-z0-9_]*$/;

const validateUid = (uid: string): void => {
  if (!UID_PATTERN.test(uid)) {
    throw new Error(
      `Invalid UID "${uid}". UIDs must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.`,
    );
  }
};

const titleFromUid = (uid: string): string =>
  uid
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const primitive = (
  kind: PrimitiveFieldDefinition["kind"],
  uid: string,
  options: BaseFieldOptions = {},
): PrimitiveFieldDefinition => {
  validateUid(uid);
  return {
    kind,
    uid,
    title: options.title ?? titleFromUid(uid),
    required: options.required ?? false,
    unique: options.unique ?? false,
    multiple: options.multiple ?? false,
    nonLocalizable: options.nonLocalizable,
    description: options.description,
    defaultValue: options.defaultValue,
    errorMessages: options.errorMessages,
    metadata: options.metadata,
  };
};

/** Create a text field. Supports multiline, regex format validation, and error messages. */
export const text = (uid: string, options: TextFieldOptions = {}): TextFieldDefinition => {
  validateUid(uid);
  return {
    kind: "text",
    uid,
    title: options.title ?? titleFromUid(uid),
    required: options.required ?? false,
    unique: options.unique ?? false,
    multiple: options.multiple ?? false,
    nonLocalizable: options.nonLocalizable,
    description: options.description,
    defaultValue: options.defaultValue,
    errorMessages: options.errorMessages,
    metadata: options.metadata,
    multiline: options.multiline,
    format: options.format,
    formatErrorMessage: options.formatErrorMessage,
  };
};

/** Create a number field. */
export const number = (uid: string, options: NumberFieldOptions = {}): PrimitiveFieldDefinition =>
  primitive("number", uid, options);

/** Create a boolean field. */
export const boolean = (uid: string, options: BooleanFieldOptions = {}): PrimitiveFieldDefinition =>
  primitive("boolean", uid, options);

/** Create a date field. Supports startDate/endDate range constraints. Maps to CMA `isodate`. */
export const date = (uid: string, options: DateFieldOptions = {}): DateFieldDefinition => {
  validateUid(uid);
  return {
    kind: "date",
    uid,
    title: options.title ?? titleFromUid(uid),
    required: options.required ?? false,
    unique: options.unique ?? false,
    multiple: options.multiple ?? false,
    nonLocalizable: options.nonLocalizable,
    description: options.description,
    defaultValue: options.defaultValue,
    errorMessages: options.errorMessages,
    metadata: options.metadata,
    startDate: options.startDate,
    endDate: options.endDate,
  };
};

/** Create a plain JSON field. For rich text, use `jsonRte()` instead. */
export const json = (uid: string, options: JsonFieldOptions = {}): PrimitiveFieldDefinition =>
  primitive("json", uid, options);

/** Create a reference field pointing to one or more content types. @throws if `to` is empty. */
export const reference = (uid: string, options: ReferenceFieldOptions): ReferenceFieldDefinition => {
  validateUid(uid);
  if (!options.to.length) throw new Error(`reference("${uid}") requires at least one target content type in "to".`);
  return { kind: "reference", uid, to: options.to, refMultipleContentTypes: options.refMultipleContentTypes, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a select/enum field with string choices or advanced {key, value} pairs. Supports `displayType` (dropdown/radio) and `minInstance`/`maxInstance`. @throws if `choices` is empty. */
export const enumField = (uid: string, options: EnumFieldOptions): EnumFieldDefinition => {
  validateUid(uid);
  if (!options.choices.length) throw new Error(`enumField("${uid}") requires at least one choice.`);
  return { kind: "enum", uid, choices: options.choices, displayType: options.displayType, advanced: options.advanced, minInstance: options.minInstance, maxInstance: options.maxInstance, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a group field containing nested fields. Set `multiple: true` for repeating groups. */
export const group = (uid: string, options: GroupFieldOptions): GroupFieldDefinition => {
  validateUid(uid);
  return { kind: "group", uid, fields: options.fields, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a modular blocks field with polymorphic block types. Always `multiple: true`. */
export const modularBlocks = (uid: string, options: ModularBlocksFieldOptions): ModularBlocksFieldDefinition => {
  validateUid(uid);
  return { kind: "modular_blocks", uid, blocks: options.blocks, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? true, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Embed a reusable global field by reference. */
export const globalField = (uid: string, options: GlobalFieldFieldOptions): GlobalFieldFieldDefinition => {
  validateUid(uid);
  return { kind: "global_field", uid, ref: options.ref, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a file/asset picker field. Supports an `extensions` allowlist. Maps to CMA `data_type: "file"`. */
export const file = (uid: string, options: FileFieldOptions = {}): FileFieldDefinition => {
  validateUid(uid);
  return {
    kind: "file",
    uid,
    title: options.title ?? titleFromUid(uid),
    required: options.required ?? false,
    unique: options.unique ?? false,
    multiple: options.multiple ?? false,
    nonLocalizable: options.nonLocalizable,
    description: options.description,
    defaultValue: options.defaultValue,
    errorMessages: options.errorMessages,
    metadata: options.metadata,
    extensions: options.extensions,
  };
};

/** Create a link field with title and URL. Maps to CMA `data_type: "link"`. */
export const link = (uid: string, options: BaseFieldOptions = {}): PrimitiveFieldDefinition =>
  primitive("link", uid, options);

/** Create a markdown text field. Maps to CMA `data_type: "text"` with `field_metadata.markdown: true`. */
export const markdown = (uid: string, options: BaseFieldOptions = {}): PrimitiveFieldDefinition =>
  primitive("markdown", uid, options);

/** Create an HTML rich text editor field. Maps to CMA `data_type: "text"` with `allow_rich_text: true`. */
export const richText = (uid: string, options: RichTextFieldOptions = {}): RichTextFieldDefinition => {
  validateUid(uid);
  return { kind: "rich_text", uid, richTextType: options.richTextType ?? "advanced", title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a JSON rich text editor field. Supports embedded entries via `referenceTo` and extension plugins via `plugins`. Maps to CMA `data_type: "json"` with `allow_json_rte: true`. */
export const jsonRte = (uid: string, options: JsonRteFieldOptions = {}): JsonRteFieldDefinition => {
  validateUid(uid);
  return { kind: "json_rte", uid, richTextType: options.richTextType ?? "advanced", referenceTo: options.referenceTo, plugins: options.plugins, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? false, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

/** Create a taxonomy field for term selection. Maps to CMA `data_type: "taxonomy"`. */
export const taxonomy = (uid: string, options: TaxonomyFieldOptions): TaxonomyFieldDefinition => {
  validateUid(uid);
  return { kind: "taxonomy", uid, taxonomies: options.taxonomies, title: options.title ?? titleFromUid(uid), required: options.required ?? false, unique: options.unique ?? false, multiple: options.multiple ?? true, nonLocalizable: options.nonLocalizable, description: options.description, defaultValue: options.defaultValue, errorMessages: options.errorMessages, metadata: options.metadata };
};

export type { FieldDefinition };
