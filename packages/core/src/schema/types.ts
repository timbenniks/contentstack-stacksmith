export const SCHEMA_VERSION = 1;

export type EntityKind = "content_type" | "global_field";

export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "json"
  | "file"
  | "link"
  | "rich_text"
  | "json_rte"
  | "markdown"
  | "reference"
  | "group"
  | "enum"
  | "modular_blocks"
  | "global_field"
  | "taxonomy";

export interface TaxonomyRef {
  taxonomy_uid: string;
  max_terms?: number | undefined;
  mandatory?: boolean | undefined;
  multiple?: boolean | undefined;
  non_localizable?: boolean | undefined;
}

export interface EnumChoiceAdvanced {
  key: string;
  value: string;
}

export interface ContentTypeOptions {
  title?: string | undefined;
  publishable?: boolean | undefined;
  is_page?: boolean | undefined;
  singleton?: boolean | undefined;
  sub_title?: string[] | undefined;
  url_pattern?: string | undefined;
  url_prefix?: string | undefined;
  [key: string]: unknown;
}

export interface EntityRef {
  kind: EntityKind;
  uid: string;
  id: string;
}

export interface DependencyRef {
  sourceEntityId: string;
  targetEntityId: string;
  sourceFieldId?: string | undefined;
  kind: EntityKind;
  uid: string;
  reason: "reference" | "global_field" | "modular_block_reference";
  description: string;
}

export interface NormalizedMetadata {
  source?: string | undefined;
  hash?: string | undefined;
  origin?: "dsl" | "remote" | undefined;
  labels?: string[] | undefined;
  [key: string]: unknown;
}

export interface CompiledBlock {
  uid: string;
  title: string;
  fields?: CompiledField[] | undefined;
  globalFieldRef?: string | undefined;
}

export interface NormalizableBlockInput {
  uid: string;
  title: string;
  fields?: NormalizableFieldInput[] | undefined;
  globalFieldRef?: string | undefined;
}

export interface NormalizableFieldInput {
  uid: string;
  previousUid?: string | undefined;
  displayName: string;
  kind: FieldKind;
  required?: boolean | undefined;
  unique?: boolean | undefined;
  multiple?: boolean | undefined;
  nonLocalizable?: boolean | undefined;
  description?: string | undefined;
  defaultValue?: unknown;
  enumChoices?: string[] | EnumChoiceAdvanced[] | undefined;
  enumAdvanced?: boolean | undefined;
  minInstance?: number | undefined;
  maxInstance?: number | undefined;
  referenceTo?: string[] | undefined;
  refMultipleContentTypes?: boolean | undefined;
  globalFieldRef?: string | undefined;
  fields?: NormalizableFieldInput[] | undefined;
  blocks?: NormalizableBlockInput[] | undefined;
  richTextType?: string | undefined;
  plugins?: string[] | undefined;
  taxonomies?: TaxonomyRef[] | undefined;
  format?: string | undefined;
  errorMessages?: Record<string, string> | undefined;
  multiline?: boolean | undefined;
  displayType?: string | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  extensions?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface CompiledField {
  id: string;
  uid: string;
  previousUid?: string | undefined;
  displayName: string;
  kind: FieldKind;
  order: number;
  required: boolean;
  unique: boolean;
  multiple: boolean;
  nonLocalizable?: boolean | undefined;
  description?: string | undefined;
  defaultValue?: unknown;
  enumChoices?: string[] | EnumChoiceAdvanced[] | undefined;
  enumAdvanced?: boolean | undefined;
  minInstance?: number | undefined;
  maxInstance?: number | undefined;
  referenceTo?: string[] | undefined;
  refMultipleContentTypes?: boolean | undefined;
  globalFieldRef?: string | undefined;
  fields?: CompiledField[] | undefined;
  blocks?: CompiledBlock[] | undefined;
  richTextType?: string | undefined;
  plugins?: string[] | undefined;
  taxonomies?: TaxonomyRef[] | undefined;
  format?: string | undefined;
  errorMessages?: Record<string, string> | undefined;
  multiline?: boolean | undefined;
  displayType?: string | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  extensions?: string[] | undefined;
  metadata: Record<string, unknown>;
  dependencies: DependencyRef[];
}

export interface CompiledEntity {
  id: string;
  kind: EntityKind;
  uid: string;
  title: string;
  description?: string | undefined;
  fields: CompiledField[];
  dependencies: DependencyRef[];
  metadata: NormalizedMetadata;
}

export interface CompiledContentType extends CompiledEntity {
  kind: "content_type";
  options?: ContentTypeOptions | undefined;
}

export interface CompiledGlobalField extends CompiledEntity {
  kind: "global_field";
}

export interface SchemaArtifact {
  schemaVersion: number;
  entities: CompiledEntity[];
  metadata: NormalizedMetadata;
}

export type OperationKind =
  | "create_entity"
  | "update_entity"
  | "delete_entity"
  | "add_field"
  | "update_field"
  | "remove_field"
  | "rename_field"
  | "reorder_fields";

export type RiskLevel = "low" | "medium" | "high" | "blocker";

export interface DiffChange {
  path: string;
  before?: unknown;
  after?: unknown;
  message: string;
}

export interface PlanRisk {
  level: RiskLevel;
  code: string;
  message: string;
  entityId?: string | undefined;
  fieldId?: string | undefined;
}

export interface PlanOperation {
  id: string;
  kind: OperationKind;
  entity: EntityRef;
  fieldUid?: string | undefined;
  status: "pending" | "blocked" | "applied";
  summary: string;
  details: DiffChange[];
  dependencies: string[];
  risks: PlanRisk[];
}

export interface DiffResult {
  local: SchemaArtifact;
  remote: SchemaArtifact;
  operations: PlanOperation[];
  warnings: PlanRisk[];
}

export interface DependencyGraph {
  nodes: EntityRef[];
  edges: DependencyRef[];
  order: string[];
  reverseOrder: string[];
  cycles: string[][];
  warnings: string[];
}

export interface ValidationFinding {
  level: RiskLevel;
  code: string;
  message: string;
  entityId?: string | undefined;
  fieldId?: string | undefined;
  operationId?: string | undefined;
}

export interface PlanSummary {
  total: number;
  creates: number;
  updates: number;
  deletes: number;
  blocked: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
}

export interface PlanArtifact {
  schemaVersion: number;
  operations: PlanOperation[];
  summary: PlanSummary;
  dependencyOrder: string[];
  dependencyNotes: string[];
  validationFindings: ValidationFinding[];
}

export interface OrgAuditFinding {
  level: RiskLevel;
  code: string;
  message: string;
  capability: string;
  planValue?: unknown;
  localValue?: unknown;
  remediation?: string | undefined;
}

export interface OrgAuditSummary {
  total: number;
  blockers: number;
  warnings: number;
  passes: number;
}

export interface OrgAuditFeatureSummary {
  enabled: boolean;
  limit: number;
  max_limit?: number | undefined;
  name?: string | undefined;
}

export interface OrgUsageMetric {
  usage: number;
  limit?: number | undefined;
  format: "number" | "bytes" | string;
}

export interface StackUsageRow {
  name: string;
  apiKey: string;
  branchName?: string | undefined;
  ownerEmail?: string | undefined;
  contentTypes: number;
  globalFields: number;
  entries: number;
  assets: number;
  environments: number;
  locales: number;
  extensions: number;
  webhooks: number;
  roles: number;
  branches: number;
  taxonomies: number;
  savedSearches: number;
}

export interface OrgUsageSnapshot {
  /** Per-processor org-level aggregates. Keys are canonical: stacks, entries, assets, content_types, etc. */
  metrics: Record<string, OrgUsageMetric>;
  /** Per-stack breakdown. Present if the `stack-usage` processor succeeded. */
  stacks: StackUsageRow[];
  /** Processors that failed + why. Lets callers see what's missing without crashing the audit. */
  errors: Array<{ processor: string; status: number; message: string }>;
}

export interface OrgAuditReport {
  organizationUid: string;
  organizationName: string;
  plan: { name: string };
  features: Record<string, OrgAuditFeatureSummary>;
  findings: OrgAuditFinding[];
  summary: OrgAuditSummary;
  usage?: OrgUsageSnapshot | undefined;
}

export interface SchemaInput {
  entities: Array<
    Omit<CompiledEntity, "id" | "dependencies" | "fields"> & {
      fields: NormalizableFieldInput[];
    }
  >;
  metadata?: NormalizedMetadata | undefined;
}
