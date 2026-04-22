# Contentstack Stacksmith — Technical Specification

**Audience:** Engineers who will maintain, extend, or debug this repository.
**Last updated:** 2026-04-22

This document is the engineering map of the codebase. For *how to use* the tools, see [`documentation.md`](./documentation.md) and the [README](../README.md). For *why it exists*, see [`prd.md`](./prd.md).

---

## 1. Repository layout

Monorepo managed by **pnpm workspaces + Turborepo**.

```
.
├── apps/
│   ├── docs                 # VitePress documentation site
│   ├── example-project      # Minimal dogfooding project
│   ├── simple-blog          # Editorial models sample
│   ├── page-builder         # Page composition sample
│   └── ecommerce            # Commerce models sample
├── packages/
│   ├── dsl                  # Public: @timbenniks/contentstack-stacksmith
│   ├── cli                  # Public: @timbenniks/contentstack-stacksmith-cli
│   ├── core                 # Internal: normalized schema, graph, diff, plan
│   ├── validators           # Internal: validation + risk classification
│   ├── agents               # Internal: Agent Skills package
│   └── test-utils           # Internal: fixtures, snapshots, tmp FS helpers
├── docs/                    # This folder
└── turbo.json
```

**Published artifacts:** only `packages/dsl` and `packages/cli`. Everything under `core`, `validators`, `test-utils`, `agents` is internal and must not be imported from outside the monorepo.

## 2. Toolchain & prerequisites

- **Node.js:** `>=20`
- **Package manager:** `pnpm` (enforced — do not use npm or yarn for installs)
- **Task runner:** Turborepo (`turbo.json`)
- **TS:** strict, `tsconfig.base.json` extends all workspace projects
- **CLI runtime:** Contentstack CLI (`csdx`) — the CLI plugin links into it

Day-to-day commands:

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run test
```

## 3. The pipeline

One directional flow powers every command:

```
DSL definitions (TS)
      │  (jiti runtime loader — executes TypeScript directly)
      ▼
Normalized schema artifact  (packages/core)
      │
      ├─► Dependency graph + topological order
      │
      ├─► Diff vs remote stack (if applicable)
      │
      ├─► Risk classification (packages/validators)
      │
      └─► Command-specific output:
           • build    → schema.json, manifest.json
           • plan     → plan.json
           • diff     → diff.json
           • apply    → CMA mutations (low-risk only)
           • promote  → CMA mutations against target stack
           • docs     → models.md / .json / .html
           • typegen  → TS .d.ts
```

### Artifact locations

All artifacts live under `<project>/.contentstack/models/`:

- `schema.json` — normalized schema (stable ordering, canonical shape)
- `manifest.json` — metadata about the compiled set (entities, dependencies)
- `plan.json` — dependency-ordered operation list
- `diff.json` — raw diff vs. remote
- `apply-state.json` — resume state, written only on partial failure
- `import-manifest.json` — ownership registry for `stacksmith:import`-managed files
- `models.md` — generated human-readable docs

## 4. Package responsibilities

### `packages/dsl` — `@timbenniks/contentstack-stacksmith`

Public authoring surface.

- Exports: `defineContentType`, `defineGlobalField`, `defineModels`, `defineModelsConfig`, and 15 field builders.
- Compiles DSL definitions into the normalized schema from `packages/core`.
- Re-exports programmatic diff/plan/validate APIs so consumers don't need `csdx`.
- Compiler guarantees a required `title` field on every content type.

### `packages/core`

Internal. The source of truth for schema shape and semantics.

- **Normalized schema types** — neutral representation independent of both DSL and CMA.
- **Canonicalization** — deterministic ordering, UID shape validation, forward-reference resolution.
- **Dependency graph** — `references`, `globalFieldRef`, and modular-block `globalFieldRef` edges.
- **Diff engine** — computes add / update / remove operations between two normalized schemas.
- **Plan assembler** — topological order that respects dependencies (globals before types that reference them, etc.).

### `packages/validators`

Internal. Gatekeeper for safety.

- Schema-shape validation (UID format, required fields, duplicate detection).
- Diff classification: each operation is tagged `low` / `medium` / `high` / `blocked`.
- Only `low` passes through `apply` / `promote` unless explicitly overridden (phase 1 does not yet support overrides).

**Allowed in apply/promote:**
create content type, create global field, add new (non-required) field, low-risk entity metadata update, low-risk field update, low-risk reorder.

**Blocked:**
delete CT, delete global field, remove field, add *required* field, change field kind, narrow reference targets, switch global field references, tighten validations.

### `packages/cli` — `@timbenniks/contentstack-stacksmith-cli`

Public `csdx` plugin. Each command is a thin orchestration layer over the internal packages.

Commands and their primary service modules (see [cli-workflow.md](./cli-workflow.md) for flag details):

| Command | Role |
|---|---|
| `stacksmith:init` | Scaffold a starter project |
| `stacksmith:import` | Fetch CTs + GFs from a stack → DSL source files |
| `stacksmith:build` | DSL → `schema.json` / `manifest.json` |
| `stacksmith:plan` | Build + optional remote diff → `plan.json` |
| `stacksmith:diff` | Raw diff output |
| `stacksmith:apply` | Execute low-risk ops against a target stack |
| `stacksmith:promote` | Local→remote or stack→stack with apply semantics |
| `stacksmith:typegen` | Emit `.d.ts` (local or via `--from-stack`) |
| `stacksmith:docs` | Emit Markdown / JSON / HTML docs |
| `stacksmith:audit-org` | Plan capability + usage cross-reference |

**Parent CLI integration.** The plugin uses the parent `csdx` runtime for all remote operations — it does not hardcode endpoints. It resolves `this.region`, `this.cmaHost`, `this.cmaAPIUrl`, `this.cdaHost`, `this.cdaAPIUrl`, `this.uiHost`, `this.getToken(...)`. Region-aware routing flows through this layer.

### `packages/agents`

Agent Skills bundle — scaffold, authoring, import, review, migration, documentation workflows. Consumed by AI-assisted tooling. Not published.

### `packages/test-utils`

Fixtures, snapshots, temp-FS helpers shared across the workspace's test suites.

## 5. Authentication

Remote commands (`apply`, `promote`, `diff`, `plan`, `import`) resolve a token using a strict precedence (see [auth-flexibility.md](./auth-flexibility.md) for details):

1. `--management-token <token>` flag — CI-friendly, highest precedence.
2. `--token-alias <alias>` — resolved via the parent CLI token store.
3. `csdx auth:login --oauth` session.
4. `csdx auth:login` basic-auth session.
5. `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN` env var.
6. Interactive masked prompt (TTY only, never under `--ci`).

Each source emits the correct HTTP header:
- Management tokens → `authorization: <token>`
- Basic sessions → `authtoken: <token>`
- OAuth → `authorization: Bearer <token>`

The token source is echoed on every remote command for debuggability.

**`stacksmith:audit-org` is user-session only.** Management tokens are stack-scoped and cannot read `/v3/organizations/{uid}`. The command refuses them upfront with a redirect to `csdx auth:login`.

## 6. Safety & recovery

### Partial-failure recovery (`apply` / `promote`)

On mid-run failure, the command writes `.contentstack/models/apply-state.json`:

```json
{ "schemaHash": "...", "applied": [...], "failed": [...], "timestamp": "..." }
```

A re-run resumes from the failed operation **iff** `schemaHash` matches. A mismatch aborts with `StaleApplyStateError` — the operator must re-run with `--reset-state`. On a clean run the state file is deleted.

### Executable DSL threat model

`contentstack.stacksmith.config.ts` and everything it imports is loaded via **jiti** as TypeScript. There is no sandbox. Rules:

- Treat model files as backend source — code review, commit, lint.
- Never run `build` / `plan` / `apply` / `promote` against DSL from untrusted sources.
- Forward-ref and UID validation runs *after* execution; hostile code can still do I/O before being rejected.

## 7. Org audit internals

`stacksmith:audit-org` calls `GET /v3/organizations/{uid}?include_plan=true` and extracts:

- **Feature flags:** `is_branch_enabled`, `is_taxonomy_enabled`, `is_global_field_enabled`, `is_json_rte_enabled`, `is_modular_blocks_enabled`, `is_webhook_enabled`, `is_extension_enabled`.
- **Numeric limits:** `max_content_types`, `max_global_fields`, `max_fields_per_content_type`, `max_group_depth`, `max_modular_block_types`, `max_branches`.

**Org UID resolution order:** `--org <uid>` → OAuth session's `oauthOrgUid` → derived from `--stack` via `GET /v3/stacks/{api_key}`.

**Fail-soft:** if the plan response has no recognizable keys, emit `UNRECOGNIZED_PLAN_SHAPE` (medium advisory) and individual rules that can't find their keys return no finding. When that advisory fires, run `scripts/capture-org-fixture.ts` and update `PLAN_KEYS` in `packages/cli/src/services/org-audit-rules.ts`.

**`--include-usage`** additionally pulls CMS analytics (org usage, per-stack counts). If analytics is disabled for the org, emit one `ANALYTICS_DISABLED` info finding and continue with plan-only checks. When combined with `--stack`, the audit projects DSL additions against that stack's current counts and emits capacity findings: `STACK_CAPACITY_OK|TIGHT|EXCEEDED|AT_CAPACITY_CONTENT_TYPES`.

## 8. Typegen internals

Two modes:

- **Local (default).** Compile local DSL → reverse-map via `RemoteSchemaMapper.toContentstackEntity()` → feed `generateTSFromContentTypes()` from `@contentstack/types-generator`. Offline, deterministic.
- **Live stack (`--from-stack`).** Fetch content types via Delivery API → feed `generateTS()` / `graphqlTS()`. Requires `--token-alias` (delivery token).

`--api-type graphql` requires `--from-stack` (no local GraphQL equivalent).

## 9. Import internals

`stacksmith:import`:

- Scaffolds a full target project when the directory is empty.
- Writes import-managed model files + a registry in `import-manifest.json`.
- Requires `--force` to refresh already-imported files.
- Refuses to read / overwrite / delete any manifest path that resolves outside the target project directory — even if the manifest itself is tampered with.
- Runs local build validation and rejects non-zero parity against the source stack.

## 10. CMA field coverage (round-trip guarantee)

The DSL + import pipeline capture the following end-to-end, so `stacksmith:import` → `stacksmith:apply` is idempotent:

- Field flags: `required`, `unique`, `multiple`, `non_localizable`
- Text: `format`, full `error_messages`, `multiline`
- Date ranges: `startDate`, `endDate`
- Enums: plain `choices`, advanced `{ key, value }` + `enum.advanced: true`, `displayType`, `min_instance`, `max_instance`
- File: `extensions` allowlist
- Reference: `reference_to`, `field_metadata.ref_multiple_content_types`
- JSON RTE: `rich_text_type`, embedded-entry `reference_to`, `plugins`
- Taxonomy: `taxonomy_uid`, `max_terms`, `mandatory`, `non_localizable` per taxonomy
- Content type options: `title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`
- Modular blocks: inline-field blocks AND global-field-reference blocks (CMA `reference_to` on a block → DSL `globalFieldRef`)

Adding a new CMA property to the round-trip requires updates in: DSL builder → core canonicalization → remote mapper (both directions) → import parser → round-trip fixture in `test-utils`.

## 11. Release & publishing

- Public packages: `packages/dsl`, `packages/cli`.
- Internal packages are marked `"private": true` (verify before any release).
- `CHANGELOG.md` at the repo root tracks releases.
- Sample apps are never published.

## 12. Extending the system

Common extension points:

- **New field kind** — add a DSL builder in `packages/dsl`, a normalized shape in `packages/core`, validation in `packages/validators`, remote mapping both directions, round-trip fixture.
- **New CLI command** — add under `packages/cli/src/commands/`, wire into oclif, delegate to a service in `packages/cli/src/services/`, keep orchestration thin.
- **New org audit rule** — add to `packages/cli/src/services/org-audit-rules.ts`. Use the `PLAN_KEYS` registry. Rules must fail-soft when their keys aren't found.
- **New risk classification** — update `packages/validators` and add a test in `test-utils` covering both accepted and blocked paths.

## 13. Known limitations

- Destructive ops are always blocked in phase 1 — no opt-in override yet.
- No sandboxing of DSL execution.
- GraphQL typegen requires `--from-stack` (no offline equivalent).
- Plan-response shape drift is handled by fail-soft advisory; regeneration is manual.

## 14. Further reading

- [Architecture overview](./architecture.md)
- [CLI workflow](./cli-workflow.md)
- [Internal schema](./internal-schema.md)
- [CMA field reference](./cma-field-reference.md)
- [Auth flexibility](./auth-flexibility.md)
- [Org audit command](./org-audit-command.md)
