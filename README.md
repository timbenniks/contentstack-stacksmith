# Contentstack Stacksmith Monorepo

TypeScript-first Contentstack models as code, plus the tooling to import, compile, diff, document, type-generate, and safely promote them.

This repository currently contains two public deliverables:

- `@timbenniks/contentstack-stacksmith`
  Author content types and global fields in TypeScript, then normalize, diff, plan, and validate them from the same package.
- `@timbenniks/contentstack-stacksmith-cli`
  A `csdx` plugin for importing, building, planning, diffing, documenting, applying, promoting, and type-generating models.

The lower-level workspace packages in `packages/core`, `packages/validators`, `packages/test-utils`, and `packages/agents` are internal implementation details and are not intended for separate npm publication.

The core workflow is:

`stack import or TypeScript model definitions -> normalized schema artifact -> diff/plan/docs/apply/promote`

## What You Get

- A shared internal schema contract between authoring and execution
- Deterministic schema compilation with stable IDs and dependency metadata
- Content type and global field authoring in regular TypeScript
- Dependency-aware plan ordering for references and global fields
- Human-readable diff and plan output
- Safe-by-default apply behavior for additive, low-risk changes
- Generated Markdown model documentation
- Type generation from live Contentstack stacks
- Several sample apps that exercise the workflow in different shapes

## CMA feature coverage

The DSL and import pipeline capture the following Contentstack CMA field properties end-to-end, so a `stacksmith:import` followed by a `stacksmith:apply` writes back exactly what was imported:

- Field-level flags: `required`, `unique`, `multiple`, `non_localizable`
- Text constraints: `format`, full `error_messages` (not only `.format`), `multiline`
- Date range constraints: `startDate`, `endDate`
- Enum fields: plain `choices`, advanced `choices` with `{ key, value }` pairs + `enum.advanced: true`, `displayType`, `min_instance`, `max_instance`
- File fields: `extensions` allowlist
- Reference fields: `reference_to`, `field_metadata.ref_multiple_content_types`
- JSON RTE: `rich_text_type`, embedded-entry `reference_to`, `plugins`
- Taxonomy: per-taxonomy `taxonomy_uid`, `max_terms`, `mandatory`, `non_localizable`
- Content type `options`: typed `title`, `publishable`, `is_page`, `singleton`, `sub_title`, `url_pattern`, `url_prefix`
- Modular blocks: both inline-field blocks **and** global-field-reference blocks (CMA `reference_to` on a block maps to DSL `globalFieldRef`)

## Monorepo Layout

```text
.
├── apps/
│   ├── ecommerce
│   ├── example-project
│   ├── page-builder
│   └── simple-blog
├── docs
├── packages/
│   ├── agents
│   ├── cli
│   ├── core
│   ├── dsl
│   ├── test-utils
│   └── validators
└── turbo.json
```

### Packages

- [`packages/dsl`](./packages/dsl)
  The public `@timbenniks/contentstack-stacksmith` library: authoring helpers plus programmatic schema, diff, plan, and validation APIs.
- [`packages/cli`](./packages/cli)
  The public `@timbenniks/contentstack-stacksmith-cli` package: a Contentstack CLI plugin that exposes `csdx stacksmith:*` commands.
- [`packages/core`](./packages/core)
  Internal normalized schema, canonicalization, graph, diff, and planning primitives.
- [`packages/validators`](./packages/validators)
  Internal validation and risk-analysis rules used by the public library and CLI.
- [`packages/test-utils`](./packages/test-utils)
  Internal fixtures, snapshots, and temporary filesystem helpers used in tests.
- [`packages/agents`](./packages/agents)
  Internal agent-skill content for scaffold, authoring, import, review, migration, and documentation workflows.

### Sample Apps

- [`apps/example-project`](./apps/example-project)
  Minimal starter project with `author`, `blog_post`, and `seo`.
- [`apps/simple-blog`](./apps/simple-blog)
  Small editorial model set with posts, authors, and categories.
- [`apps/page-builder`](./apps/page-builder)
  Page-building models with shared blocks and richer composition.
- [`apps/ecommerce`](./apps/ecommerce)
  Commerce-flavored models including products, collections, stores, and brands.

### Docs Site

- [`apps/docs`](./apps/docs)
  VitePress-powered documentation site. Run `pnpm --filter @timbenniks/contentstack-stacksmith-docs dev` for local preview, or `pnpm --filter @timbenniks/contentstack-stacksmith-docs build` to produce a static site in `apps/docs/.vitepress/dist/`.

## Prerequisites

- Node.js `>=20`
- `pnpm`
- Contentstack CLI (`csdx`) for plugin linking and real stack operations

If you do not already have the Contentstack CLI installed:

```bash
npm install -g @contentstack/cli
```

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Validate the workspace

```bash
npm run build
npm run typecheck
npm run lint
npm run test
```

### 3. Link the local CLI plugin into `csdx`

```bash
cd packages/cli
csdx plugins:link .
cd ../..
```

### 4. Build models from the example project

```bash
csdx stacksmith:build --cwd apps/example-project
```

This writes artifacts to:

- `apps/example-project/.contentstack/models/schema.json`
- `apps/example-project/.contentstack/models/manifest.json`

### 5. Preview a local plan and diff

```bash
csdx stacksmith:plan --cwd apps/example-project
csdx stacksmith:diff --cwd apps/example-project
```

These also write:

- `apps/example-project/.contentstack/models/plan.json`
- `apps/example-project/.contentstack/models/diff.json`

### 6. Generate model docs

```bash
csdx stacksmith:docs --cwd apps/example-project
```

This writes:

- `apps/example-project/.contentstack/models/models.md`

## Authoring Models

The DSL lets developers define Contentstack models in TypeScript instead of hand-authoring raw CMA JSON.

```ts
import {
  defineContentType,
  defineGlobalField,
  globalField,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";

export const seo = defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});

export const blogPost = defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

Available field builders:

- `text`
- `number`
- `boolean`
- `date`
- `json`
- `file`
- `link`
- `markdown`
- `richText`
- `jsonRte`
- `reference`
- `group`
- `enumField`
- `modularBlocks`
- `globalField`
- `taxonomy`

For content types, the compiler always ensures a required `title` field is present in the compiled schema.

## Project Configuration

Each consuming project uses a `contentstack.stacksmith.config.ts` file:

```ts
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-contentstack-project",
  modelsEntry: "./src/models/index.ts",
  outDir: "./.contentstack/models",
  strict: true,
});
```

Default values:

- `modelsEntry`: `./src/models/index.ts`
- `outDir`: `./.contentstack/models`
- `strict`: `true`

## CLI Commands

After linking the plugin, these commands are available through `csdx`:

### `csdx stacksmith:init`

Scaffold a starter project with config and example models.

```bash
csdx stacksmith:init --dir ./my-models-project
```

### `csdx stacksmith:build`

Compile TypeScript models into a normalized schema artifact.

```bash
csdx stacksmith:build --cwd apps/example-project
csdx stacksmith:build --cwd apps/example-project --json
```

### `csdx stacksmith:import`

Import content types and global fields from a Contentstack stack into DSL source files.

```bash
# Any of --token-alias, --management-token, or a csdx auth:login session works:
csdx stacksmith:import --cwd apps/developers-cs-website --stack <stack_api_key>

# Replace previously imported files:
csdx stacksmith:import \
  --cwd apps/developers-cs-website \
  --stack <stack_api_key> \
  --token-alias <management_token_alias> \
  --force
```

### `csdx stacksmith:plan`

Create a dependency-aware plan from local models, with optional remote comparison.

```bash
csdx stacksmith:plan --cwd apps/example-project

csdx stacksmith:plan \
  --cwd apps/example-project \
  --stack <stack_api_key> \
  --token-alias <management_token_alias> \
  --branch main
```

### `csdx stacksmith:diff`

Show or export the raw diff and candidate operations.

```bash
csdx stacksmith:diff --cwd apps/example-project
csdx stacksmith:diff --cwd apps/example-project --json
```

### `csdx stacksmith:apply`

Apply only low-risk additive changes to a target stack.

```bash
# Uses your csdx auth:login session or --management-token if provided:
csdx stacksmith:apply --cwd apps/example-project --stack <stack_api_key>

# With an explicit token alias:
csdx stacksmith:apply \
  --cwd apps/example-project \
  --stack <stack_api_key> \
  --token-alias <management_token_alias>

# Preview without mutating the stack:
csdx stacksmith:apply --cwd apps/example-project --stack <stack_api_key> --dry-run
```

For automation:

```bash
csdx stacksmith:apply \
  --cwd apps/example-project \
  --stack <stack_api_key> \
  --management-token "$CS_MGMT_TOKEN" \
  --yes \
  --ci
```

If an apply fails partway through, a state file is written to `.contentstack/models/apply-state.json`. Re-running the command resumes from where it stopped (only replaying operations that didn't succeed). If you changed your DSL between runs, the state becomes stale — re-run with `--reset-state` to discard it.

Flags: `--dry-run`, `--yes`, `--reset-state`, `--management-token`, `--token-alias`, `--stack`, `--branch`, `--ci`, `--json`.

### `csdx stacksmith:audit-org`

Audit your Contentstack organization's plan capabilities and cross-reference them against your local DSL. Flags blockers before you hit mid-apply CMA errors — missing features (taxonomy not enabled, global fields gated) and numeric limit overruns (too many content types for your tier).

```bash
# Capabilities-only: what does my org support?
csdx stacksmith:audit-org --org <org_uid>

# Full audit: does my local DSL fit my plan?
csdx stacksmith:audit-org --cwd apps/simple-blog --org <org_uid>

# OAuth users: --org is auto-derived from the session
csdx auth:login --oauth
csdx stacksmith:audit-org --cwd apps/simple-blog

# Stack-derived org UID
csdx stacksmith:audit-org --stack <api_key> --cwd apps/example-project --json
```

**Auth:** requires `csdx auth:login` or `csdx auth:login --oauth`. Management tokens are stack-scoped and cannot read `/v3/organizations/{uid}` — the command refuses them up-front with a redirect to `auth:login`.

**Org UID resolution:** `--org` → `oauthOrgUid` from `auth:login --oauth` session → derivation from `--stack` (via `GET /v3/stacks/{key}`).

Non-zero exit when any blocker finding is present.

#### CMS usage cross-reference (`--include-usage`)

When you pass `--include-usage`, the audit also reads your org's CMS analytics (subscription usage, per-stack counts) so you can answer "will this import fit into stack X?" before you try:

```bash
# Org-wide survey: how much of each plan limit are we using?
csdx stacksmith:audit-org --include-usage

# Targeted stack: does my DSL fit into the current headroom?
csdx stacksmith:audit-org --stack <api_key> --cwd apps/simple-blog --include-usage
```

When `--stack` is combined with `--include-usage`, the audit projects the local DSL's content-type and global-field additions against that stack's current counts and emits findings like:

- `STACK_CAPACITY_OK_CONTENT_TYPES` — plenty of headroom
- `STACK_CAPACITY_TIGHT_CONTENT_TYPES` — import fits, but only just
- `STACK_CAPACITY_EXCEEDED_CONTENT_TYPES` — blocker: import would exceed the plan limit
- `STACK_AT_CAPACITY_CONTENT_TYPES` — blocker: stack is already full

**If analytics isn't enabled for your org** (typically requires Organization Owner/Admin, and the feature may be off by default on some plans), the audit emits a single `ANALYTICS_DISABLED` informational finding and continues with the plan-capabilities check. Nothing else fails. You can ignore `--include-usage` and the rest of the audit still works.

#### Exporting a report (`--output`)

Write the full audit report to a file in Markdown (human-readable, great for support tickets) or JSON (structured, great for CI):

```bash
# Markdown (default when extension is .md)
csdx stacksmith:audit-org --include-usage --output audit-report.md

# JSON
csdx stacksmith:audit-org --include-usage --output audit-report.json

# Explicit format overrides extension inference
csdx stacksmith:audit-org --include-usage --output-format md --output /tmp/report.txt
```

The Markdown report includes the organization identity, plan, findings grouped by severity with remediation notes, a plan-features table, and (when `--include-usage` is on) a usage snapshot + per-stack usage table. Attach it to a Contentstack support ticket and they'll have everything they need to help.

### `csdx stacksmith:docs`

Generate documentation from compiled models in Markdown, JSON, or HTML.

```bash
csdx stacksmith:docs --cwd apps/example-project
csdx stacksmith:docs --cwd apps/example-project --format json --output ./docs/models.json
csdx stacksmith:docs --cwd apps/example-project --format html --output ./docs/models.html
```

### `csdx stacksmith:typegen`

Generate TypeScript definitions from your local DSL (default — no network, no auth needed) or from a live Contentstack stack via `--from-stack`.

```bash
# Local (default): generates from compiled DSL, works offline, deterministic.
csdx stacksmith:typegen --cwd apps/example-project --output ./types/contentstack.d.ts

# Live stack (opt-in): fetches content types via the Delivery API.
csdx stacksmith:typegen \
  --from-stack \
  --token-alias <delivery_token_alias> \
  --output ./types/contentstack.d.ts
```

GraphQL mode (`--api-type graphql`) requires `--from-stack` — it needs a live endpoint. The `--token-alias` flag is only required when `--from-stack` is set.

Options: `--from-stack`, `--prefix`, `--include-system-fields`, `--include-editable-tags`, `--include-referenced-entry`, `--api-type rest|graphql`, `--branch` (with `--from-stack`), `--namespace` (GraphQL only).

### `csdx stacksmith:promote`

Promote models from local files or from a source stack to a target stack.

```bash
# Local to remote
csdx stacksmith:promote \
  --cwd apps/example-project \
  --stack <target_stack_api_key> \
  --token-alias <target_token_alias>

# Stack to stack (source and target each have their own token flags)
csdx stacksmith:promote \
  --source-stack <source_api_key> \
  --source-token-alias <source_token_alias> \
  --stack <target_api_key> \
  --token-alias <target_token_alias>

# Preview the changes without touching the target:
csdx stacksmith:promote --cwd apps/example-project --stack <target_api_key> --dry-run
```

Flags: `--dry-run`, `--yes`, `--reset-state`, `--management-token`, `--source-management-token`, `--token-alias`, `--source-token-alias`, `--stack`, `--source-stack`, `--branch`, `--source-branch`, `--ci`, `--json`. Auth resolution is the same as `stacksmith:apply` — any of `--management-token`, `--token-alias`, `csdx auth:login` session, `CS_AUTHTOKEN` env, or interactive prompt.

## Safety Model

This implementation is intentionally conservative.

Allowed in `stacksmith:apply` and `stacksmith:promote`:

- create content type
- create global field
- add a new field
- low-risk entity metadata updates
- low-risk field updates
- low-risk reorder updates

Blocked or unsupported in phase 1:

- deleting content types
- deleting global fields
- removing fields
- adding required fields
- changing field kinds
- narrowing reference targets
- switching global field references
- tightening validations in risky ways
- any operation classified above `low`

### DSL files are executable code

Model files (`.contentstack/models.config.ts` and any file it imports) are loaded and executed via [jiti](https://github.com/unjs/jiti) as TypeScript. Treat them like any other source file in your repo:

- They can import from `node_modules`, read files, make network calls, or run arbitrary code. The CLI does not sandbox execution.
- Do not run `csdx stacksmith:build`, `stacksmith:plan`, `stacksmith:apply`, or `stacksmith:promote` against DSL files received from untrusted sources. A malicious model file can exfiltrate tokens or do filesystem I/O before any validation runs.
- Forward-reference and uid-shape validation happen *after* the DSL has executed. Malformed or hostile code can still consume resources before it's rejected.
- Commit model files, code-review them on PRs, and keep them under the same scrutiny as backend source code.

If you are authoring models yourself in a trusted repo, none of this changes day-to-day use.

## Common Development Flows

Build the workspace:

```bash
npm run build
```

Typecheck the workspace:

```bash
npm run typecheck
```

Lint the workspace:

```bash
npm run lint
```

Run tests:

```bash
npm run test
```

Build models for one sample app without linking globally:

```bash
cd packages/cli
pnpm exec csdx stacksmith:build --cwd ../../apps/example-project
cd ../..
```

## Contentstack Authentication Notes

Remote commands (`stacksmith:apply`, `stacksmith:promote`, `stacksmith:diff`, `stacksmith:plan`, `stacksmith:import`) resolve auth from the first of these sources that yields a token:

1. `--management-token <token>` flag (CI-friendly; highest precedence).
2. `--token-alias <alias>` (registered via `csdx auth:tokens:add`).
3. `csdx auth:login --oauth` session — OAuth access token from the parent CLI.
4. `csdx auth:login` session — basic-auth session token from the parent CLI.
5. `CS_AUTHTOKEN` or `CONTENTSTACK_MANAGEMENT_TOKEN` environment variable.
6. Interactive prompt (TTY only, never under `--ci`) — masked input for a management token. Not persisted.

Each source emits the right HTTP header to the CMA (`authorization: <token>` for management tokens, `authtoken: <token>` for basic sessions, `authorization: Bearer <token>` for OAuth). Token source is printed on every remote command so you can tell which one was used:

```
Token Source: csdx auth:login --oauth session
```

### CI examples

```bash
# Env var:
CS_AUTHTOKEN=$TOKEN csdx stacksmith:apply --stack blt123 --ci --yes

# Explicit flag:
csdx stacksmith:apply --stack blt123 --management-token "$TOKEN" --ci --yes

# Alias (requires csdx auth:tokens:add in a prior step):
csdx stacksmith:apply --stack blt123 --token-alias my-stack --ci --yes
```

### Interactive examples

```bash
# If you've done csdx auth:login, this just works:
csdx stacksmith:apply --stack blt123

# If nothing is set up, you'll get a masked prompt for a management token:
csdx stacksmith:apply --stack blt123
# Enter a Contentstack management token for apply: ********
```

The plugin reads region-aware CMA and CDA hosts from the parent Contentstack CLI context.

## Additional Documentation

- [Architecture](./docs/architecture.md)
- [Internal Schema](./docs/internal-schema.md)
- [CLI Workflow](./docs/cli-workflow.md)
- [Generated Models Docs Example](./docs/models.md)
