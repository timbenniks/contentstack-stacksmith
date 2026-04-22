# `@timbenniks/contentstack-stacksmith-cli`

Contentstack CLI plugin for managing Contentstack models as code.

Once linked into `csdx`, this package exposes:

- `csdx stacksmith:init`
- `csdx stacksmith:import`
- `csdx stacksmith:build`
- `csdx stacksmith:plan`
- `csdx stacksmith:diff`
- `csdx stacksmith:apply`
- `csdx stacksmith:docs`
- `csdx stacksmith:typegen`
- `csdx stacksmith:promote`
- `csdx stacksmith:audit-org`

## Development Setup

Build and link the plugin locally:

```bash
cd packages/cli
pnpm build
csdx plugins:link .
```

Run it against the sample app from this package directory:

```bash
csdx stacksmith:build --cwd ../../apps/example-project
csdx stacksmith:plan --cwd ../../apps/example-project
csdx stacksmith:diff --cwd ../../apps/example-project
csdx stacksmith:docs --cwd ../../apps/example-project
```

Or run it from the repo root without linking globally:

```bash
cd packages/cli
pnpm exec csdx stacksmith:build --cwd ../../apps/example-project
cd ../..
```

## Command Summary

### `stacksmith:init`

Scaffolds a starter project with:

- `contentstack.stacksmith.config.ts`
- `src/models/index.ts`
- `src/models/content-types/author.ts`
- `src/models/content-types/blog-post.ts`
- `src/models/global-fields/seo.ts`

```bash
csdx stacksmith:init --dir ./my-models-project
```

### `stacksmith:build`

Compiles local TypeScript models into normalized artifacts.

```bash
csdx stacksmith:build --cwd ../../apps/example-project
csdx stacksmith:build --cwd ../../apps/example-project --json
```

Outputs:

- `schema.json`
- `manifest.json`

### `stacksmith:import`

Imports content types and global fields from a source stack into DSL source files, then validates that the generated project builds and matches the remote stack exactly.

```bash
csdx stacksmith:import \
  --cwd ../../apps/developers-cs-website \
  --stack <stack_api_key> \
  --token-alias <management_token_alias>

csdx stacksmith:import \
  --cwd ../../apps/developers-cs-website \
  --stack <stack_api_key> \
  --token-alias <management_token_alias> \
  --force
```

Key behavior:

- scaffolds a full target project when the directory is empty
- generates one file per content type and global field
- writes `.contentstack/models/import-manifest.json` for refresh ownership
- refuses to overwrite generated model files unless `--force` is provided
- fails if the imported DSL cannot reach zero diff against the source stack

### `stacksmith:plan`

Builds a dependency-aware plan from local models and an optional remote stack snapshot.

```bash
csdx stacksmith:plan --cwd ../../apps/example-project

csdx stacksmith:plan \
  --cwd ../../apps/example-project \
  --stack <stack_api_key> \
  --token-alias <management_token_alias> \
  --branch main
```

Default output: `plan.json`

### `stacksmith:diff`

Produces raw operations and changes between local models and a target stack.

```bash
csdx stacksmith:diff --cwd ../../apps/example-project
csdx stacksmith:diff --cwd ../../apps/example-project --output ./tmp/diff.json
```

Default output: `diff.json`

### `stacksmith:apply`

Applies safe, low-risk changes to a target stack. It aborts when the plan contains blocked operations. On partial failure, writes `.contentstack/models/apply-state.json` so the next run resumes instead of replaying already-applied ops (pass `--reset-state` to discard stale state after a DSL edit).

```bash
# Auth resolved from session, alias, or --management-token flag:
csdx stacksmith:apply --cwd ../../apps/example-project --stack <stack_api_key>

# Preview without mutating:
csdx stacksmith:apply --cwd ../../apps/example-project --stack <stack_api_key> --dry-run
```

For automation:

```bash
csdx stacksmith:apply \
  --cwd ../../apps/example-project \
  --stack <stack_api_key> \
  --management-token "$CS_MGMT_TOKEN" \
  --yes \
  --ci
```

Extra flags: `--dry-run`, `--reset-state`, `--management-token`.

### `stacksmith:docs`

Generates documentation from the compiled schema in Markdown, JSON, or HTML.

```bash
csdx stacksmith:docs --cwd ../../apps/example-project
csdx stacksmith:docs --cwd ../../apps/example-project --format json --output ./docs/models.json
csdx stacksmith:docs --cwd ../../apps/example-project --format html --output ./docs/models.html
```

Default outputs:

- `models.md` for `--format md`
- `models.json` for `--format json`
- `models.html` for `--format html`

### `stacksmith:typegen`

Generates TypeScript definitions. Default path is local — compiles your DSL and feeds it to `@contentstack/types-generator` with no network. Live-stack mode is opt-in via `--from-stack`.

```bash
# Local (default): offline, deterministic:
csdx stacksmith:typegen --cwd ../../apps/example-project --output ./types/contentstack.d.ts

# Live stack (opt-in), REST:
csdx stacksmith:typegen \
  --from-stack \
  --token-alias <delivery_token_alias> \
  --output ./types/contentstack.d.ts

# GraphQL (requires --from-stack):
csdx stacksmith:typegen \
  --from-stack \
  --token-alias <delivery_token_alias> \
  --output ./types/graphql.d.ts \
  --api-type graphql \
  --namespace ContentstackTypes
```

Useful options: `--from-stack`, `--prefix`, `--branch` (with `--from-stack`), `--include-system-fields`, `--include-editable-tags`, `--include-referenced-entry`, `--api-type rest|graphql`, `--namespace`, `--no-doc`.

### `stacksmith:promote`

Promotes models to a target stack from either local compiled models or a source stack. Supports `--dry-run` and partial-failure recovery via the same `apply-state.json` mechanism as `stacksmith:apply`.

```bash
# Local source
csdx stacksmith:promote \
  --cwd ../../apps/example-project \
  --stack <target_stack_api_key> \
  --token-alias <target_token_alias>

# Remote source (source and target each have their own auth flags)
csdx stacksmith:promote \
  --source-stack <source_stack_api_key> \
  --source-token-alias <source_token_alias> \
  --stack <target_stack_api_key> \
  --token-alias <target_token_alias>

# Preview without mutating the target:
csdx stacksmith:promote --cwd ../../apps/example-project --stack <target_api_key> --dry-run
```

Extra flags: `--dry-run`, `--reset-state`, `--management-token`, `--source-management-token`.

### `stacksmith:audit-org`

Audits your Contentstack organization's plan against local DSL. Flags plan-gated features (taxonomy, global fields, JSON RTE, etc.) and numeric limit overruns before you hit them mid-apply.

```bash
# Capabilities-only (no local cross-reference)
csdx stacksmith:audit-org --org <org_uid>

# Full audit against local DSL; org UID auto-derived from OAuth session
csdx auth:login --oauth
csdx stacksmith:audit-org --cwd ../../apps/simple-blog
```

Requires a user session (`csdx auth:login` or `csdx auth:login --oauth`). Management tokens are rejected up-front — org endpoints are scoped to users, not stacks. See the [CLI reference](../../apps/docs/reference/cli.md#csdx-models-audit-org) for full details.

## Shared Flags

Local build-related commands support:

- `--cwd`
- `--config`
- `--out-dir`
- `--json`
- `--ci`

Remote compare and apply flows additionally support:

- `--stack`
- `--token-alias`
- `--management-token` (raw token; overrides `--token-alias` and any parent CLI session)
- `--branch`
- `--region`

Auth resolution precedence: `--management-token` flag → `--token-alias` → `csdx auth:login --oauth` session → `csdx auth:login` basic session → `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN` env → interactive masked prompt (TTY + not `--ci`). Under `--ci` with nothing configured, the command exits with a multi-line error listing every supported option.

## Safety Notes

- `stacksmith:apply` and `stacksmith:promote` only proceed when every operation in the computed plan is low risk.
- Adding required fields is classified as high risk and is not applied in phase 1.
- Destructive changes like entity deletion and field removal are blocked.
- Risky field mutations such as kind changes, required tightening, unique tightening, reference narrowing, and global-field ref changes are blocked.
- Additive optional fields, low-risk entity metadata changes, and reorder-only changes are allowed.

## Implementation Notes

- Commands extend `Command` from `@contentstack/cli-command`.
- Runtime auth and region details come from the parent Contentstack CLI context.
- CMA and CDA hosts are resolved dynamically rather than hardcoded.
