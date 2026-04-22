# CLI Workflow

## `stacksmith:init`

Scaffolds a starter project with config and example model definitions.

## `stacksmith:build`

Builds normalized schema artifacts into `.contentstack/models`.

Artifacts:

- `schema.json`
- `manifest.json`

## `stacksmith:plan`

Builds local schema, optionally loads remote stack shape, computes diff and dependency order, then writes `plan.json`.

Remote planning uses the parent Contentstack CLI runtime rather than hardcoded endpoints.
The plugin resolves:

- `this.region`
- `this.cmaHost`
- `this.cmaAPIUrl`
- `this.cdaHost`
- `this.cdaAPIUrl`
- `this.uiHost`
- `this.getToken(...)`

The full CMA base URL comes from the parent CLI's `cmaAPIUrl`, while token aliases are resolved through the parent CLI token store.

## `stacksmith:diff`

Prints or writes the raw diff result and the candidate operations.

## `stacksmith:apply`

Rebuilds, re-plans, confirms with the user unless `--yes` or `--ci` is supplied, then executes only low-risk additive operations.

Remote apply follows the same parent CLI integration rules as `stacksmith:plan` and `stacksmith:diff`, so region-aware endpoints and authentication flow through the installed `csdx` runtime.

Blocked examples:

- entity deletion
- field removal
- field type change
- required-field tightening

Additional capabilities:

- `--dry-run` prints the plan and exits before any mutation.
- Partial-failure recovery: on mid-run failures, the command writes `.contentstack/models/apply-state.json` (with `schemaHash`, `applied`, `failed`, `timestamp`). A subsequent run resumes from there when the schema hash matches; mismatches abort with `StaleApplyStateError` unless `--reset-state` is passed. The state file is deleted on a clean (zero-failure) run.

Auth resolution (shared with `plan`, `diff`, `promote`, `import`) walks: `--management-token` flag → `--token-alias` → `csdx auth:login --oauth` session → `csdx auth:login` basic session → `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN` env → interactive masked prompt (TTY + not `--ci`). Each source emits the correct HTTP header: `authorization: <token>` for management, `authtoken: <token>` for basic sessions, `authorization: Bearer <token>` for OAuth.

## `stacksmith:typegen`

Generates TypeScript type definitions. Two modes:

- **Local mode (default)** — compiles local DSL, reverse-maps via `RemoteSchemaMapper.toContentstackEntity()`, feeds `generateTSFromContentTypes()` from `@contentstack/types-generator`. No stack, no token, no network.
- **Live-stack mode (`--from-stack`)** — fetches content types via the Delivery API and feeds them to `generateTS()` / `graphqlTS()`. Requires `--token-alias` (delivery token).

GraphQL mode (`--api-type graphql`) requires `--from-stack` — no local GraphQL equivalent.

Key flags: `--from-stack`, `--token-alias` (only with `--from-stack`), `--output`, `--prefix`, `--include-system-fields`, `--api-type`.

## `stacksmith:promote`

Promotes models to a target stack. Two modes:

- **Local-to-remote** (no `--source-stack`): compiles local models and applies to target stack. Similar to `stacksmith:apply` but with explicit target naming.
- **Stack-to-stack** (`--source-stack` provided): fetches source stack schema and applies differences to target stack.

Uses the same plan/apply pipeline as `stacksmith:apply` — blocked operations are rejected, confirmation is required. Supports `--dry-run` (preview without mutating the target) and `--reset-state`. Source and target each accept their own auth flags: `--token-alias` / `--management-token` for target; `--source-token-alias` / `--source-management-token` for source.

## `stacksmith:import`

Fetches content types and global fields from a source stack and generates DSL source files from them.

The command:

- scaffolds a full target project when the directory is empty
- writes import-managed model files plus a registry
- records ownership in `.contentstack/models/import-manifest.json`
- requires `--force` for refresh
- refuses to read, overwrite, or delete import-managed paths that resolve outside the target project directory, even if the manifest is tampered with
- runs local build validation and rejects non-zero parity against the source stack

## `stacksmith:audit-org`

Audits an organization's plan against the local DSL. Calls `GET /v3/organizations/{uid}?include_plan=true`, extracts feature flags (`is_branch_enabled`, `is_taxonomy_enabled`, `is_global_field_enabled`, `is_json_rte_enabled`, `is_modular_blocks_enabled`, `is_webhook_enabled`, `is_extension_enabled`) and numeric limits (`max_content_types`, `max_global_fields`, `max_fields_per_content_type`, `max_group_depth`, `max_modular_block_types`, `max_branches`), runs a rule pipeline, and emits a blocker/warning/pass report.

**Auth:** user session only (session authtoken or OAuth access token). Management tokens are stack-scoped; org endpoints reject them. The command refuses `--management-token`, `--token-alias`, and `CS_AUTHTOKEN`/`CONTENTSTACK_MANAGEMENT_TOKEN` env vars with a redirect to `csdx auth:login`.

**Org UID resolution:** `--org <uid>` → `oauthOrgUid` from the OAuth session → derivation from `--stack` via `GET /v3/stacks/{api_key}`.

**Fail-soft shape:** if the plan response lacks any recognizable keys, an `UNRECOGNIZED_PLAN_SHAPE` medium advisory surfaces and rules that can't find their keys return no finding. Refresh the fixture via `scripts/capture-org-fixture.ts` and update `PLAN_KEYS` in [packages/cli/src/services/org-audit-rules.ts](../packages/cli/src/services/org-audit-rules.ts) when that advisory fires.

Key flags: `--org`, `--stack`, `--cwd` (+ `--config` for local cross-reference), `--json`, `--ci`.

## `stacksmith:docs`

Generates documentation from compiled model definitions in Markdown, JSON, or HTML. Output includes:

- Entity list with field tables (uid, kind, required, description)
- Dependency lists per entity
- A dependency graph section

Key flags:

- `--format` (`md`, `json`, `html`; defaults to `md`)
- `--output` (defaults to `{outDir}/models.<ext>`)
- standard build flags
