# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- **Modular blocks can now reference global fields.** Each entry in `modularBlocks({ blocks: [...] })` is either an inline block (`{ uid, title, fields }`) or a global-field-reference block (`{ uid, title, globalFieldRef }`). The reference shape maps to the CMA's `reference_to` on a block and creates a `modular_block_reference` dependency in the normalized schema.
- **Expanded CMA field coverage** end-to-end through DSL, mapper, codegen, and diff:
  - `nonLocalizable` on every field (CMA `non_localizable`)
  - Full `errorMessages` pass-through (not just `error_messages.format`)
  - Enum advanced mode with `{ key, value }` choices and `enum.advanced: true`
  - Enum `minInstance` / `maxInstance`
  - File field `extensions` allowlist
  - Reference `refMultipleContentTypes` (CMA `field_metadata.ref_multiple_content_types`)
  - JSON RTE `plugins`
  - Taxonomy per-item `non_localizable`
  - Typed `ContentTypeOptions` (`title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`)
- **`stacksmith:import` detects monorepo context.** Generated `package.json` now uses `"@timbenniks/contentstack-stacksmith": "workspace:*"` when a `pnpm-workspace.yaml`, `package.json#workspaces`, or `lerna.json` is found above the target directory, so `pnpm install` works without manual edits.

### Fixed

- **`stacksmith:import` crash on modular blocks that reference global fields.** `block.schema.map is not a function` at `remote-schema-mapper.ts` when a CMA block used `reference_to` instead of `schema`. Fix adds first-class support for the reference shape across the pipeline.
- **Parity check drift on empty `description` / empty `extensions` / falsy `multiline`.** The mapper preserved empty strings and arrays from the CMA while the codegen stripped them; normalized both sides to `undefined` for clean canonical comparison.

### Changed

- **Public npm surface reduced.** `@timbenniks/contentstack-stacksmith` is now the single public library package for authoring plus programmatic schema tooling. The lower-level workspace packages are private implementation details.
- `CompiledField` / `NormalizableFieldInput` gained `nonLocalizable`, `plugins`, `extensions`, `refMultipleContentTypes`, `minInstance`, `maxInstance`, `enumAdvanced`. `enumChoices` widened to `string[] | EnumChoiceAdvanced[]`. `errorMessages` widened from `{ format?: string }` to `Record<string, string>`.
- `CompiledBlock` / `NormalizableBlockInput` gained optional `globalFieldRef` and made `fields` optional.
- `TaxonomyRef` gained optional `non_localizable`.
- `CompiledContentType.options` is now typed as `ContentTypeOptions` instead of `Record<string, unknown>`.
- `diffSchemas` `comparableKeys` extended to include every new field property, so `stacksmith:diff` and `stacksmith:apply` detect drift on them.
- `DependencyRef.reason` gained `modular_block_reference` for the new block-embed case.

## [0.1.0] - 2024

### Added

- Initial release of contentstack-stacksmith monorepo
- **Core package** (`@timbenniks/contentstack-stacksmith-core`): normalized schema, diffing, dependency graph, plan creation
- **DSL package** (`@timbenniks/contentstack-stacksmith`): TypeScript builders for content types and global fields
  - Field builders: `text`, `number`, `boolean`, `date`, `json`, `file`, `link`, `markdown`, `richText`, `jsonRte`, `reference`, `enumField`, `group`, `modularBlocks`, `globalField`, `taxonomy`
  - Entity definitions: `defineContentType`, `defineGlobalField`, `defineModels`
  - Compilation: `compileDefinitions`, `compileModelRegistry`
- **Validators package** (`@timbenniks/contentstack-stacksmith-validators`): schema validation, diff validation, plan risk analysis
- **CLI package** (`@timbenniks/contentstack-stacksmith-cli`): Contentstack CLI plugin
  - Commands: `stacksmith:init`, `stacksmith:build`, `stacksmith:plan`, `stacksmith:diff`, `stacksmith:apply`, `stacksmith:typegen`, `stacksmith:promote`, `stacksmith:docs`
  - Remote stack integration with pagination, retry logic, and rate limiting
  - Safe low-risk apply with confirmation prompts
- **Phase 1 (Critical)**: API pagination, retry logic, nested field diffing, recursive validation, input validation, title field enforcement
- **Phase 2 (High)**: File/asset, link, rich text, JSON RTE, markdown, taxonomy field types; field constraints; partial failure recovery; credential validation; breaking change detection; friendly error messages; CI/CD pipeline
- **Phase 3 (Medium)**: lowRisk counting fix, deleted entity deps, options diffing, dangling reference warnings, medium risk analysis, build output details, human-readable diff, exhaustive field kind check, narrowed defaultValue types, UID validation, empty array validation, dynamic version strings
- **Phase 4 (Low)**: Topological sort optimization, Set-based fallback, JSDoc documentation, LICENSE, CHANGELOG, CONTRIBUTING, SECURITY
- **Phase 5 (Test Coverage)**: 132 tests across all packages (up from 50), comprehensive coverage for normalize, diff, graph, plan, builders, entities, compilation, validators, and error cases
- **Phase 6 (Feature Parity)**: 3 new CLI commands
  - `stacksmith:typegen` — TypeScript type generation (wraps `@contentstack/types-generator`)
  - `stacksmith:promote` — promote models local-to-remote or stack-to-stack
  - `stacksmith:docs` — Markdown documentation generation with Mermaid dependency graphs
  - Advanced Patterns documentation (shared field sets, factory functions, conditional fields)
