import type { ContentTypeOptions, EnumChoiceAdvanced, FieldKind, NormalizedMetadata, TaxonomyRef } from "../public-types.js";

export type { ContentTypeOptions, EnumChoiceAdvanced } from "../public-types.js";

export interface BaseFieldOptions {
  title?: string | undefined;
  required?: boolean | undefined;
  unique?: boolean | undefined;
  multiple?: boolean | undefined;
  nonLocalizable?: boolean | undefined;
  description?: string | undefined;
  defaultValue?: unknown;
  errorMessages?: Record<string, string> | undefined;
  metadata?: Record<string, unknown> | undefined;
  /**
   * The previous uid of this field. Set when renaming a field to let the diff
   * engine emit a single `rename_field` operation instead of a drop + add
   * (which would lose entry data on populated content types). Only supported
   * on top-level fields of a content type or global field; fields nested
   * inside groups or modular blocks cannot be renamed in place.
   */
  previousUid?: string | undefined;
}

export interface ReferenceFieldOptions extends BaseFieldOptions {
  to: string[];
  refMultipleContentTypes?: boolean | undefined;
}

export interface GlobalFieldFieldOptions extends BaseFieldOptions {
  ref: string;
}

export interface TextFieldOptions extends BaseFieldOptions {
  defaultValue?: string | undefined;
  multiline?: boolean | undefined;
  format?: string | undefined;
  formatErrorMessage?: string | undefined;
}

export interface TextFieldDefinition extends BaseFieldDefinition {
  kind: "text";
  multiline?: boolean | undefined;
  format?: string | undefined;
  formatErrorMessage?: string | undefined;
}

export interface NumberFieldOptions extends BaseFieldOptions {
  defaultValue?: number | undefined;
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  defaultValue?: boolean | undefined;
}

export interface DateFieldOptions extends BaseFieldOptions {
  defaultValue?: string | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
}

export interface JsonFieldOptions extends BaseFieldOptions {
  defaultValue?: Record<string, unknown> | undefined;
}

export interface DateFieldDefinition extends BaseFieldDefinition {
  kind: "date";
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
}

export interface FileFieldOptions extends BaseFieldOptions {
  extensions?: string[] | undefined;
}

export interface EnumFieldOptions extends BaseFieldOptions {
  choices: string[] | EnumChoiceAdvanced[];
  displayType?: "dropdown" | "radio" | undefined;
  advanced?: boolean | undefined;
  minInstance?: number | undefined;
  maxInstance?: number | undefined;
}

export interface GroupFieldOptions extends BaseFieldOptions {
  fields: FieldDefinition[];
}

export interface ModularInlineBlockDefinition {
  uid: string;
  title: string;
  fields: FieldDefinition[];
}

export interface ModularGlobalFieldBlockDefinition {
  uid: string;
  title: string;
  globalFieldRef: string;
}

export type ModularBlockDefinition =
  | ModularInlineBlockDefinition
  | ModularGlobalFieldBlockDefinition;

export interface ModularBlocksFieldOptions extends BaseFieldOptions {
  blocks: ModularBlockDefinition[];
}

export interface BaseFieldDefinition extends BaseFieldOptions {
  kind: FieldKind;
  uid: string;
}

export interface PrimitiveFieldDefinition extends BaseFieldDefinition {
  kind: "number" | "boolean" | "json" | "link" | "markdown";
}

export interface ReferenceFieldDefinition extends BaseFieldDefinition, ReferenceFieldOptions {
  kind: "reference";
}

export interface GlobalFieldFieldDefinition extends BaseFieldDefinition, GlobalFieldFieldOptions {
  kind: "global_field";
}

export interface EnumFieldDefinition extends BaseFieldDefinition {
  kind: "enum";
  choices: string[] | EnumChoiceAdvanced[];
  displayType?: "dropdown" | "radio" | undefined;
  advanced?: boolean | undefined;
  minInstance?: number | undefined;
  maxInstance?: number | undefined;
}

export interface FileFieldDefinition extends BaseFieldDefinition {
  kind: "file";
  extensions?: string[] | undefined;
}

export interface GroupFieldDefinition extends BaseFieldDefinition, GroupFieldOptions {
  kind: "group";
}

export interface ModularBlocksFieldDefinition extends BaseFieldDefinition, ModularBlocksFieldOptions {
  kind: "modular_blocks";
}

export interface RichTextFieldOptions extends BaseFieldOptions {
  richTextType?: string | undefined;
}

export interface RichTextFieldDefinition extends BaseFieldDefinition, RichTextFieldOptions {
  kind: "rich_text";
}

export interface JsonRteFieldOptions extends BaseFieldOptions {
  richTextType?: string | undefined;
  referenceTo?: string[] | undefined;
  plugins?: string[] | undefined;
}

export interface JsonRteFieldDefinition extends BaseFieldDefinition, JsonRteFieldOptions {
  kind: "json_rte";
}

export interface TaxonomyFieldOptions extends BaseFieldOptions {
  taxonomies: TaxonomyRef[];
}

export interface TaxonomyFieldDefinition extends BaseFieldDefinition, TaxonomyFieldOptions {
  kind: "taxonomy";
}

export type FieldDefinition =
  | PrimitiveFieldDefinition
  | TextFieldDefinition
  | DateFieldDefinition
  | FileFieldDefinition
  | ReferenceFieldDefinition
  | GlobalFieldFieldDefinition
  | EnumFieldDefinition
  | GroupFieldDefinition
  | ModularBlocksFieldDefinition
  | RichTextFieldDefinition
  | JsonRteFieldDefinition
  | TaxonomyFieldDefinition;

export interface ContentTypeDefinition {
  entityType: "content_type";
  uid: string;
  title: string;
  description?: string | undefined;
  fields: FieldDefinition[];
  options?: ContentTypeOptions | undefined;
  metadata?: NormalizedMetadata | undefined;
}

export interface GlobalFieldDefinition {
  entityType: "global_field";
  uid: string;
  title: string;
  description?: string | undefined;
  fields: FieldDefinition[];
  metadata?: NormalizedMetadata | undefined;
}

export type ModelDefinition = ContentTypeDefinition | GlobalFieldDefinition;

export interface ModelRegistry {
  contentTypes?: ContentTypeDefinition[] | undefined;
  globalFields?: GlobalFieldDefinition[] | undefined;
  definitions?: ModelDefinition[] | undefined;
}

export interface ModelsConfig {
  projectName: string;
  modelsEntry?: string | undefined;
  outDir?: string | undefined;
  strict?: boolean | undefined;
  region?: string | undefined;
  branch?: string | undefined;
  defaults?: Record<string, unknown> | undefined;
}
