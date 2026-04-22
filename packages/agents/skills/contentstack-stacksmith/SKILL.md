---
name: contentstack-stacksmith
description: Manages the full Contentstack models-as-code workflow — scaffold projects, author content types and global fields in TypeScript, build and validate schemas, diff and plan against remote stacks, and safely apply changes. Use when asked to create, edit, build, diff, plan, apply, or troubleshoot Contentstack model definitions.
license: MIT
---

# Contentstack Stacksmith

Read these references before working with models:

- [DSL API](references/dsl-api.md)
- [CLI reference](references/cli-reference.md)
- [Project conventions](references/project-conventions.md)
- [Common patterns](references/common-patterns.md)

## Use this skill when

- the user wants to scaffold a new models-as-code project
- the user wants a new content type or global field
- the user wants fields added, removed, or changed on an existing model
- the user describes a model in natural language and wants TypeScript DSL output
- the user wants the models registry updated correctly
- the user wants to build, validate, diff, plan, or apply model changes
- the user wants to understand what would change on a remote stack
- the user needs help troubleshooting build or validation errors
- the user wants to refactor models (extract global fields, rename UIDs, reorganize files)

---

## Workflow: Project scaffolding

Use when the user wants to start a new models-as-code project from scratch.

1. Run `csdx stacksmith:init` in the target directory. Use `--dir <path>` if the user specifies a location.
2. If the user wants to skip prompts, add `--yes` or `--ci`.
3. After scaffolding, read the generated `contentstack.stacksmith.config.ts` and the models entry file.
4. Explain the generated structure to the user.
5. If the user wants to customize the config (project name, output directory, strict mode), edit `contentstack.stacksmith.config.ts`.

---

## Workflow: Model authoring

Use when the user wants to create or edit content types and global fields.

### Steps

1. Find the nearest `contentstack.stacksmith.config.ts`.
2. Read the config and resolve `modelsEntry` and `outDir`.
3. Read the current model registry file and the model files already referenced by it.
4. Infer the preferred file layout from the project itself. Reuse existing directories, file naming, and registry patterns instead of assuming a fixed structure.
5. If the project has no established layout yet, default to a conventional structure near `modelsEntry`, such as `content-types/` and `global-fields/`.
6. Reuse existing entities when possible instead of creating duplicates.
7. Create or update TypeScript files using only the supported DSL helpers from `@timbenniks/contentstack-stacksmith`.
8. Update the registry file so new definitions are imported and included in `defineModels(...)`.
9. Run `stacksmith:build` to validate.
10. If the build reports validation issues, fix the model files and rerun.
11. Report the changed files and the build result.

### Authoring rules

- One entity per file unless the project already groups them.
- Prefer the project's existing model directories and file naming conventions.
- If no established layout exists, use conventional directories next to the registry file: `content-types/*.ts` and `global-fields/*.ts`.
- Export entities as `export default defineContentType(...)` or `export default defineGlobalField(...)`.
- Keep UIDs in `snake_case` unless the project already uses another convention.
- Use only supported DSL field builders. Do not invent unsupported APIs.
- Prefer optional fields unless the user explicitly asks for `required: true`.
- Use `reference("field_uid", { to: ["target_uid"] })` for content-type references.
- Use `globalField("field_uid", { ref: "global_field_uid" })` for global field usage.
- Preserve the project's existing import, export, and registry style.
- When adding references, verify the target content type exists or create it in the same change.
- Do not touch remote Contentstack state unless the user explicitly asks.

### Supported DSL surface

Use only these helpers unless the project already exposes something else:

- Entity helpers: `defineContentType`, `defineGlobalField`, `defineModels`, `defineModelsConfig`
- Field builders: `text`, `number`, `boolean`, `date`, `json`, `reference`, `enumField`, `group`, `modularBlocks`, `globalField`

---

## Workflow: Build and validate

Use when the user wants to compile models or check for errors.

### Steps

1. Run `csdx stacksmith:build --cwd <project-root>`.
2. If the project has a wrapper script for build validation, prefer that local convention.
3. On success, the build writes `schema.json` and `manifest.json` to the configured `outDir` (default `.contentstack/models/`).
4. If the build reports errors, read the error output and fix the source files:
   - Duplicate UIDs: rename one of the conflicting entities or fields.
   - Missing reference targets: create the missing content type or fix the UID.
   - Missing global fields: create the missing global field or fix the ref.
   - Invalid field options: check the DSL API reference for correct signatures.
5. Rerun until the build passes.

### Build flags

- `--config <path>` — custom config file location
- `--cwd <path>` — working directory
- `--out-dir <path>` — override output directory
- `--json` — machine-readable JSON output
- `--ci` — non-interactive mode

### Understanding build artifacts

- `schema.json` — normalized entity definitions with fields, dependencies, and ordering. This is the source of truth for what the CLI will diff and apply.
- `manifest.json` — build metadata including compiler version, source file list, and schema hash. Useful for debugging or CI caching.

---

## Workflow: Diff

Use when the user wants to see what changed between local models and a remote stack, or just wants a human-readable summary of differences.

### Steps

1. Ensure `stacksmith:build` passes first.
2. Run `csdx stacksmith:diff --cwd <project-root>` with remote flags if comparing against a stack.
3. Summarize the diff: new entities, modified fields, removed entities.
4. If the user just wants a local-only diff (no remote), `stacksmith:build` output and reading `schema.json` is sufficient.

### Remote diff flags

- `--stack <api_key>` or `-s` — stack API key
- `--token-alias <alias>` or `-t` — management token alias
- `--branch <name>` — Contentstack branch
- `--region <alias>` or `-r` — region alias
- `--output <path>` — write diff JSON to file
- `--json` — machine-readable output

---

## Workflow: Plan

Use when the user asks for a remote comparison, rollout preview, branch-aware planning, or wants to understand what would change on a stack before applying.

### Steps

1. Ensure local `stacksmith:build` passes.
2. Gather the stack API key, token alias, branch, and region if needed.
3. Run `csdx stacksmith:plan --cwd <project-root>` with remote flags.
4. Summarize the plan, especially:
   - How many operations are planned.
   - Which operations are low-risk (safe to apply).
   - Which operations are blocked or high-risk.
   - The dependency order (what gets created first).
5. Do not apply changes unless the user explicitly asks.

### Plan flags

Same as diff, plus:
- `--output <path>` — write the plan JSON to a specific file

### Understanding plan output

The plan produces `plan.json` containing ordered operations:
- Each operation has a `type` (create, update, delete), a `target` entity, and a `risk` level.
- Operations are dependency-ordered: referenced entities are created before their dependents.
- Low-risk operations: create content type, create global field, add new field.
- High-risk / blocked operations: delete entity, remove field, change field type, tighten validations.

---

## Workflow: Apply

Use only on explicit user instruction. This changes remote Contentstack state.

### Steps

1. Ensure `stacksmith:build` passes.
2. Run `stacksmith:plan` first and show the user what will change.
3. If the plan contains blocked or high-risk operations, stop and explain why they are blocked.
4. Only proceed with `csdx stacksmith:apply` after explicit confirmation.
5. Use the project's existing command style and provided flags exactly; do not guess stack credentials.
6. Remind the user that `stacksmith:apply` changes remote Contentstack state.

### Apply flags

- `--stack <api_key>` or `-s` — stack API key (required)
- `--token-alias <alias>` or `-t` — management token alias
- `--branch <name>` — Contentstack branch
- `--region <alias>` or `-r` — region alias
- `--yes` or `-y` — skip confirmation prompt
- `--ci` — non-interactive mode
- `--json` — machine-readable output

### Apply guardrails

- Never run `stacksmith:apply` implicitly.
- Only run after the user explicitly asks for apply behavior.
- Prefer showing `stacksmith:plan` output first.
- If the plan contains blocked or high-risk operations, stop and explain.
- `stacksmith:apply` only executes low-risk additive operations. Destructive changes are blocked by the CLI.
- Blocked operations include: entity deletion, field removal, field type changes, required-field tightening, reference target changes.

---

## Workflow: Refactoring

Use when the user wants to reorganize, rename, or extract parts of their models.

### Extract a global field from inline fields

1. Identify the repeated field group across content types.
2. Create a new global field file with `defineGlobalField(...)` containing the shared fields.
3. Replace the inline fields in each content type with `globalField("uid", { ref: "new_global_field_uid" })`.
4. Add the new global field to the registry.
5. Build and validate.

### Rename a field UID

Renaming a field UID is a breaking change on a live stack. Warn the user.

1. Update the field UID in the model file.
2. Build to check for validation errors.
3. If the content type is live, `stacksmith:plan` will show this as a field removal + field addition (not a rename). The old field's data will not migrate automatically.

### Reorganize file structure

1. Move files to the new locations.
2. Update all import paths in the registry file.
3. Build and validate.

### Split a content type

1. Create the new content type file with the extracted fields.
2. Remove those fields from the original content type.
3. Add a `reference(...)` field if the two types need to relate.
4. Update the registry.
5. Build and validate.

---

## Troubleshooting

### Build fails with "duplicate UID"

Two entities or fields share the same UID. Search the model files for the duplicate and rename one.

### Build fails with "missing reference target"

A `reference(..., { to: ["some_uid"] })` points to a content type that doesn't exist in the registry. Either create the missing content type or fix the UID.

### Build fails with "missing global field"

A `globalField(..., { ref: "some_uid" })` references a global field not in the registry. Either create the missing global field or fix the ref.

### Plan shows "blocked" operations

The CLI blocks destructive operations: field removal, type changes, entity deletion. These require manual intervention in the Contentstack UI or a migration strategy.

### Config file not found

The CLI looks for `contentstack.stacksmith.config.ts` in the working directory. Use `--config <path>` or `--cwd <path>` to point to the correct location.

### Import errors in registry

Check that all model files use `export default` and that import paths match the actual file locations. The registry must import each entity and include it in the correct array (`contentTypes` or `globalFields`).

---

## Expected outputs

For model authoring, typically create or update:
- The model file(s) in the project's preferred location.
- The registry file with updated imports and `defineModels(...)`.

When summarizing work, report:
- Which files changed.
- Which entities were added or updated.
- Whether `stacksmith:build` passed.
- Any follow-up suggestions (run `stacksmith:plan`, review blocked operations, etc.).
