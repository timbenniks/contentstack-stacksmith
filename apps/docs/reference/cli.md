# CLI Reference

The Contentstack Stacksmith CLI plugin adds `stacksmith:*` commands to the Contentstack CLI (`csdx`). All commands support human-readable output by default and machine-readable JSON output with the `--json` flag.

## Shared flags

Flags are organized into three groups, shared across multiple commands.

**Automation flags** (available on all commands):

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--ci` | — | `false` | Disable prompts and require non-interactive behavior. |
| `--json` | — | `false` | Emit machine-readable JSON output. |

**Build flags** (available on `build`, `plan`, `diff`, `apply`):

| Flag | Short | Description |
|------|-------|-------------|
| `--config` | — | Path to `contentstack.stacksmith.config.ts`. |
| `--cwd` | — | Working directory for resolving project files. |
| `--out-dir` | — | Override the config output directory for generated artifacts. |

**Remote flags** (available on `plan`, `diff`, `apply`, `import`, `promote`):

| Flag | Short | Description |
|------|-------|-------------|
| `--stack` | `-s` | Stack API key used for remote compare and apply. |
| `--token-alias` | `-t` | Contentstack management token alias. |
| `--management-token` | — | Raw management token. Overrides `--token-alias` and any parent CLI session. |
| `--branch` | — | Contentstack branch name. |
| `--region` | `-r` | Contentstack region alias. |

### Auth resolution

Remote commands resolve a token from the first available source, in priority order:

1. `--management-token <token>` flag (CI-friendly)
2. `--token-alias <alias>` (registered via `csdx auth:tokens:add`)
3. `csdx auth:login --oauth` session — OAuth access token from the parent CLI
4. `csdx auth:login` session — basic-auth session token from the parent CLI
5. Environment variable `CS_AUTHTOKEN` or `CONTENTSTACK_MANAGEMENT_TOKEN`
6. Interactive masked prompt (TTY only, never under `--ci`)

Each source sends the correct HTTP header: `authorization: <token>` for management tokens, `authtoken: <token>` for basic sessions, `authorization: Bearer <token>` for OAuth. The `Token Source:` line in the command output tells you which source was used. Under `--ci` with no token available, the command exits with a multi-line message listing every supported option.

---

## `csdx stacksmith:init`

Scaffold a starter models-as-code project structure with example content types and a global field.

```bash
# Interactive — prompts for target directory
csdx stacksmith:init

# Non-interactive — specify directory
csdx stacksmith:init --dir ./my-models --yes

# Overwrite existing files
csdx stacksmith:init --dir ./my-models --force

# CI mode — no prompts, JSON output
csdx stacksmith:init --dir ./my-models --ci --json
```

**Flags:**

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--dir` | — | `.` (prompted) | Target directory to scaffold. |
| `--force` | — | `false` | Overwrite existing files. Without this flag, the command fails if any file already exists. |
| `--yes` | `-y` | `false` | Accept the default target directory without prompting. |
| `--ci` | — | `false` | Disable prompts. |
| `--json` | — | `false` | Return machine-readable JSON output. |

**Generated files:**

| File | Description |
|------|-------------|
| `contentstack.stacksmith.config.ts` | Project configuration with default settings |
| `src/models/index.ts` | Model registry importing all definitions |
| `src/models/content-types/author.ts` | Example content type with a required `name` field |
| `src/models/content-types/blog-post.ts` | Example content type with references and a global field |
| `src/models/global-fields/seo.ts` | Example global field with `meta_title` and `meta_description` |

---

## `csdx stacksmith:import`

Import content types and global fields from a Contentstack stack into DSL source files.

```bash
csdx stacksmith:import \
  --cwd ./apps/my-website \
  --stack blt123abc \
  --token-alias my-stack

csdx stacksmith:import \
  --cwd ./apps/my-website \
  --stack blt123abc \
  --token-alias my-stack \
  --force
```

**Flags:** [Remote flags](#shared-flags) + automation flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--cwd` | — | `.` | Target project directory. |
| `--stack` | `-s` | — | **(required)** Source stack API key. |
| `--token-alias` | `-t` | — | Management token alias for the source stack. |
| `--management-token` | — | — | Raw management token. Overrides `--token-alias`. |
| `--branch` | — | — | Source branch to import from. |
| `--force` | — | `false` | Replace existing import-managed model files. |
| `--ci` | — | `false` | Non-interactive mode. |
| `--json` | — | `false` | Emit machine-readable JSON output. |

See [Auth resolution](#auth-resolution) for the full precedence chain.

**Behavior:**

- scaffolds a full target project when the directory is empty
- generates one file per global field and content type plus `src/models/index.ts`
- writes `.contentstack/models/import-manifest.json` to track refresh ownership
- refuses to overwrite generated model files unless `--force` is provided
- runs `stacksmith:build` and then rejects any residual diff against the source stack
- detects a surrounding monorepo (walks up looking for `pnpm-workspace.yaml`, a `package.json` with `workspaces`, or `lerna.json`) and uses `"@timbenniks/contentstack-stacksmith": "workspace:*"` in the generated `package.json` instead of a version literal, so `pnpm install` works without manual edits

### CMA property coverage (roundtrip-safe)

The generated DSL captures every documented CMA field property, so a subsequent `stacksmith:apply` writes back exactly what was imported:

- Field-level: `required`, `unique`, `multiple`, `non_localizable`, `description`, `defaultValue`, full `errorMessages`, `metadata`
- Text: `format`, `formatErrorMessage`, `multiline`
- Date: `startDate`, `endDate`
- Enum: plain or advanced `{ key, value }` choices, `advanced`, `displayType`, `min_instance`, `max_instance`
- File: `extensions`
- Reference: `reference_to` (as `to`), `ref_multiple_content_types`
- Global field: `reference_to` as single string (as `ref`)
- JSON RTE: `rich_text_type` (including custom values), embedded-entry `reference_to`, `plugins`
- Taxonomy: per-taxonomy `taxonomy_uid`, `max_terms`, `mandatory`, `multiple`, `non_localizable`
- Modular blocks: inline blocks **and** blocks that reference a global field via `reference_to` (generated as `{ uid, title, globalFieldRef }`)
- Content type `options`: typed `ContentTypeOptions` (`title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`) plus arbitrary pass-through keys

---

## `csdx stacksmith:build`

Compile TypeScript model definitions into normalized schema artifacts.

```bash
# Build from current directory
csdx stacksmith:build

# Build with custom config path
csdx stacksmith:build --config ./custom.config.ts

# Build with JSON output
csdx stacksmith:build --json

# Build to a custom output directory
csdx stacksmith:build --out-dir ./output
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

**Output artifacts:**

- `schema.json` — Normalized schema with all entities, fields, and dependencies
- `manifest.json` — Build metadata including schema hash, source files, and compiler versions

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Build succeeded (may include non-blocking warnings) |
| `1` | Build completed but has blocking validation findings (e.g., duplicate UIDs, missing references) |

---

## `csdx stacksmith:plan`

Create a dependency-aware plan by comparing local models to a target stack.

```bash
# Local-only plan (compare against empty baseline)
csdx stacksmith:plan

# Plan against a remote stack
csdx stacksmith:plan \
  --stack blt123abc \
  --token-alias my-stack \
  --branch main

# Write plan to a custom file
csdx stacksmith:plan --output ./my-plan.json

# JSON output for CI
csdx stacksmith:plan --stack blt123abc --token-alias my-stack --json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Description |
|----------------|-------------|
| `--output` | Write the plan JSON to a specific file. Defaults to `{outDir}/plan.json`. |

**Behavior:**

- **Without remote flags:** Compares your local schema against an empty baseline. Every entity and field appears as a `create_entity` or `add_field` operation.
- **With remote flags:** Fetches the current content types and global fields from your Contentstack stack and diffs against your local definitions.
- `--token-alias`, `--branch`, and `--region` require `--stack` so remote compares cannot silently fall back to an empty baseline.

The plan includes:

- All operations with their risk classification
- A summary with counts (creates, updates, deletes, blocked, low-risk, high-risk)
- Dependency order for safe execution
- All validation findings

---

## `csdx stacksmith:diff`

Show a raw diff between local models and a target stack. Similar to `stacksmith:plan` but outputs the raw diff operations without risk classification or dependency ordering.

```bash
# Diff against empty baseline
csdx stacksmith:diff

# Diff against a remote stack
csdx stacksmith:diff \
  --stack blt123abc \
  --token-alias my-stack

# JSON output
csdx stacksmith:diff --stack blt123abc --token-alias my-stack --json

# Write diff to a custom file
csdx stacksmith:diff --output ./my-diff.json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Description |
|----------------|-------------|
| `--output` | Write the diff JSON to a specific file. Defaults to `{outDir}/diff.json`. |

**Behavior:**

- **Without remote flags:** Compares your local schema against an empty baseline.
- **With remote flags:** Fetches the current content types and global fields from your Contentstack stack and diffs against your local definitions.
- `--token-alias`, `--branch`, and `--region` require `--stack` so remote compares cannot silently fall back to an empty baseline.

---

## `csdx stacksmith:apply`

Safely apply low-risk additive model changes to a Contentstack stack.

```bash
# Uses your csdx auth:login session if present, or prompts in a TTY:
csdx stacksmith:apply --stack blt123abc

# With an explicit alias (unchanged from before):
csdx stacksmith:apply --stack blt123abc --token-alias my-stack

# Preview the plan without touching the stack:
csdx stacksmith:apply --stack blt123abc --dry-run

# Full CI mode with an env-var token:
CS_AUTHTOKEN=$MGMT csdx stacksmith:apply --stack blt123abc --yes --ci --json
```

**Flags:** [Build flags](#shared-flags) + [Remote flags](#shared-flags) + [Automation flags](#shared-flags)

| Additional Flag | Short | Default | Description |
|----------------|-------|---------|-------------|
| `--yes` | `-y` | `false` | Skip the confirmation prompt after validations pass. |
| `--dry-run` | — | `false` | Print the plan and exit without contacting the stack. |
| `--reset-state` | — | `false` | Discard any existing `apply-state.json` before running. |

**Requirements:**

- `--stack` is **required** (the command exits with an error without it)
- A management token is **required** — see [Auth resolution](#auth-resolution). If nothing is configured and you're under `--ci`, the command exits with a multi-line error listing every supported mechanism.

**Safety checks:**

1. If the plan contains **any blocked operations** (blocker-level), apply aborts with an error.
2. Only **low-risk operations** are executed.
3. Operations are executed in **dependency order** (dependencies created before dependents).
4. A **confirmation prompt** is shown before applying (unless `--yes` or `--ci`).

**Partial-failure recovery:**

If any operation fails mid-apply, the command writes `.contentstack/models/apply-state.json` with `{ schemaHash, applied, failed, timestamp }`. On the next run:

- If the schema hash matches, already-applied operations are skipped and the retry picks up where it left off.
- If the hash differs (you've edited your DSL), the command aborts with `StaleApplyStateError`. Re-run with `--reset-state` to discard the old state and start over.
- On a clean run with zero failures, the state file is automatically deleted.

---

## `csdx stacksmith:typegen`

Generate TypeScript type definitions from your local DSL (default — no network, no auth) or from a live Contentstack stack via `--from-stack`. Wraps the official `@contentstack/types-generator` library.

### Local mode (default)

The default path compiles your local DSL, reverse-maps it to the Contentstack content-type shape, and feeds it to `generateTSFromContentTypes()` from `@contentstack/types-generator`. No stack, no token, no network. Types reflect the *intended* schema — useful in CI before `stacksmith:apply` has landed the changes.

```bash
# Local types from DSL — works offline, deterministic:
csdx stacksmith:typegen \
  --cwd apps/my-website \
  --output ./types/contentstack.d.ts

# With prefix and system fields:
csdx stacksmith:typegen \
  --cwd apps/my-website \
  --output ./types/contentstack.d.ts \
  --prefix I \
  --include-system-fields
```

### Live-stack mode (opt-in)

Pass `--from-stack` to fetch content types from the stack's Delivery API and generate types from what's actually live. Requires a delivery token.

```bash
# REST via live stack:
csdx stacksmith:typegen \
  --from-stack \
  --token-alias my-delivery-token \
  --output ./types/contentstack.d.ts

# GraphQL (requires --from-stack; no local equivalent):
csdx stacksmith:typegen \
  --from-stack \
  --token-alias my-delivery-token \
  --output ./types/graphql.d.ts \
  --api-type graphql \
  --namespace ContentstackTypes
```

`--api-type graphql` without `--from-stack` exits with a clear error — GraphQL typegen needs a live endpoint.

**Flags:** [Build flags](#shared-flags) (local mode) + [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--from-stack` | — | `false` | Fetch content types from a live stack instead of the local DSL. |
| `--token-alias` | `-a` | — | Delivery token alias. **Required when `--from-stack` is set.** |
| `--output` | `-o` | — | **(required)** Output file path. |
| `--prefix` | `-p` | `""` | Interface prefix (e.g. `"I"` for `IBlogPost`). |
| `--doc` / `--no-doc` | `-d` | `true` | Include JSDoc comments. |
| `--branch` | — | — | Branch (live-stack mode only). |
| `--include-system-fields` | — | `false` | Include `uid`, `created_at`, etc. |
| `--include-editable-tags` | — | `false` | Include editable tags for visual builder. |
| `--include-referenced-entry` | — | `false` | Add a generic `ReferencedEntry` interface. |
| `--api-type` | — | `rest` | `rest` or `graphql`. GraphQL requires `--from-stack`. |
| `--namespace` | — | — | Namespace for GraphQL types. |

---

## `csdx stacksmith:promote`

Promote models from local definitions or a source stack to a target stack.

```bash
# Local to remote (uses compiled local models as source)
csdx stacksmith:promote \
  --stack blt_target \
  --token-alias target-token

# Stack to stack (source and target each have their own token flags)
csdx stacksmith:promote \
  --source-stack blt_dev \
  --source-token-alias dev-token \
  --stack blt_staging \
  --token-alias staging-token

# Preview without mutating the target:
csdx stacksmith:promote --cwd apps/example-project --stack blt_target --dry-run
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--source-stack` | — | — | Source stack API key. If omitted, local compiled models are used. |
| `--source-token-alias` | — | — | Management token alias for the source stack. |
| `--source-management-token` | — | — | Raw management token for the source stack. Overrides `--source-token-alias`. |
| `--source-branch` | — | — | Branch on the source stack. |
| `--stack` | `-s` | — | **(required)** Target stack API key. |
| `--token-alias` | — | — | Management token alias for the target stack. |
| `--management-token` | — | — | Raw management token for the target stack. Overrides `--token-alias`. |
| `--branch` | — | — | Branch on the target stack. |
| `--yes` | `-y` | `false` | Skip confirmation prompt. |
| `--dry-run` | — | `false` | Print the plan and exit without mutating the target stack. |
| `--reset-state` | — | `false` | Discard any existing `apply-state.json` before running. |

Auth for both source and target follows the [Auth resolution](#auth-resolution) precedence chain. Partial-failure recovery works the same way as `stacksmith:apply`: `.contentstack/models/apply-state.json` is written on failure and consumed on retry. Uses the same safety model as `stacksmith:apply` — blocked operations are rejected.

---

## `csdx stacksmith:audit-org`

Audit your Contentstack organization's plan capabilities and (optionally) CMS usage, then cross-reference both against your local DSL. Reports `[BLOCKER]` / `[HIGH]` / `[MEDIUM]` / `[LOW]` findings for feature gaps and numeric limit overruns so you catch problems *before* they surface as mid-apply CMA errors.

```bash
# Capabilities-only report (no local DSL cross-reference)
csdx stacksmith:audit-org --org blt-org-uid

# Auto-derive org UID from an OAuth session
csdx auth:login --oauth
csdx stacksmith:audit-org --cwd apps/simple-blog

# Derive org UID from a stack
csdx stacksmith:audit-org --stack blt123abc --cwd apps/example-project

# CI with JSON output
csdx stacksmith:audit-org --cwd apps/simple-blog --ci --json

# Full audit + CMS usage cross-reference + Markdown report for support
csdx stacksmith:audit-org --include-usage --output audit-report.md
```

### Auth

This command requires a **user session** (`csdx auth:login` or `csdx auth:login --oauth`). Management tokens are stack-scoped and cannot read organization-level endpoints; the command refuses `--management-token`, `--token-alias`, and `CS_AUTHTOKEN` env vars with a redirect to `auth:login`.

### Org UID resolution

Three-tier fallback (first match wins):

1. `--org <uid>` (explicit)
2. `oauthOrgUid` from a `csdx auth:login --oauth` session
3. Derivation via `GET /v3/stacks/{flag.stack}` → `organization_uid`

If none resolve, the command exits with a multi-line error listing all three options.

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--org` | — | — | Organization UID. Falls back to session or `--stack` derivation. |
| `--stack` | `-s` | — | Stack API key. Derives the org UID when `--org` is omitted, and focuses stack-usage findings when `--include-usage` is on. |
| `--cwd` | — | — | Project root. When set (with `--config`), the local DSL is built and cross-referenced against the plan. |
| `--config` | — | — | Path to `contentstack.stacksmith.config.ts`. |
| `--out-dir` | — | — | Override the build output directory (only relevant with `--cwd`). |
| `--include-usage` | — | `false` | Also fetch CMS analytics (stack counts, entries, assets, etc.) and cross-reference against plan limits. Requires org analytics to be enabled. |
| `--output <path>` | — | — | Write the full audit report to a file. Format is inferred from the extension: `.json` or `.md` (default: `.md`). |
| `--output-format <json\|md>` | — | — | Explicit output format for `--output`. Overrides extension inference. |
| `--ci` | — | `false` | Non-interactive mode. |
| `--json` | — | `false` | Emit machine-readable JSON to stdout (parseable, no ANSI). |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit ran; zero blocker findings. |
| `1` | Audit ran; at least one blocker finding. Plan cannot support current DSL or usage. |

### Example output

```
Organization: Tim Benniks Employee Org (blt481c598b0d8352d9)
Plan: Employee Default Marketplace Plan

Plan features (27):
  ✓ branches (limit: 5/5)
  ✓ content_types (limit: 1000)
  ✓ global_fields (limit: 1000)
  ✓ maxContentTypesPerJsonRte (limit: 15)
  ✓ maxContentTypesPerReferenceField (limit: 25)
  ✓ maxContentTypesPerRichTextField (limit: 10)
  ✓ maxDynamicBlockObjects (limit: 120)
  ✓ maxDynamicBlocksNestingDepth (limit: 6)
  ✓ maxDynamicBlocksPerContentType (limit: 20)
  ✓ maxFieldsLimit (limit: 250)
  ✓ max_taxonomies_per_content_type (limit: 20)
  ✓ taxonomy (limit: 20)
  …

Summary: 0 blocker(s), 0 warning(s), 2 pass(es).
```

With `--include-usage` against a stack:

```
Usage (org-wide, last 30 days):
  assets: 1,046 / 30,000 (3%)
  branches: 23 / 500 (5%)
  content types: 72 / 1,000 (7%)
  entries: 2,025 / 30,000 (7%)
  environments: 27 / 100 (27%)
  global fields: 56 / 1,000 (6%)
  stacks: 23 / 100 (23%)
  users: 4 / 100 (4%)

Stacks surveyed: 23
  timbenniks.dev (blt8699317c576dde05): 8 CT, 11 GF, 74 entries, 212 assets
  Contentstack Kickstart (blte766efb491f96715): 7 CT, 3 GF, 102 entries, 61 assets
  …

Summary: 0 blocker(s), 0 warning(s), 12 pass(es).
```

### Known behavior

- **`UNRECOGNIZED_PLAN_SHAPE` advisory.** If Contentstack's response doesn't include any plan-feature entries the command recognizes, a single medium-level finding points you at the capture script. Rules fail soft (return no finding) rather than crashing on shape drift.
- **Analytics not enabled.** `--include-usage` is best-effort. If analytics isn't enabled for your org (it requires Organization Owner/Admin and may be gated per plan), the command emits a single `ANALYTICS_DISABLED` informational finding and continues with the plan-capabilities audit. You can always run without `--include-usage`.
- **Partial analytics outage.** If only some processors fail (e.g., upstream 5xx on 2 of 14), you'll get per-processor `ANALYTICS_PROCESSOR_UNAVAILABLE` notes (capped at 5) and the rest of the data still populates.
- **Stack-lookup failures under user auth.** A session token may not have read access to every stack in the org. If `--stack` derivation 403s, pass `--org` explicitly or use an account with stack access.
- **Exporting reports.** `--output audit-report.md` writes a Markdown file with org identity, plan, findings grouped by severity with remediation notes, plan-features table, and (when `--include-usage` is on) usage + per-stack usage tables. Attach it to a Contentstack support ticket for faster help.

---

## `csdx stacksmith:docs`

Generate documentation from compiled model definitions in Markdown, JSON, or HTML.

```bash
csdx stacksmith:docs

csdx stacksmith:docs --format json --output ./docs/content-models.json

csdx stacksmith:docs --format html --output ./docs/content-models.html
```

**Flags:** [Build flags](#shared-flags) + [Automation flags](#shared-flags)

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--format` | — | `md` | Documentation format: `md`, `json`, or `html`. |
| `--output` | — | `{outDir}/models.<ext>` | Output file path. |

**Output includes:**

- Entity list with field tables (uid, kind, required, description)
- Dependency relationships per entity
- A dependency graph section
