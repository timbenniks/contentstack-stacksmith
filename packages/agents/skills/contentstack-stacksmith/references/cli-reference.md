# CLI Reference

All commands are exposed as subcommands of the Contentstack CLI (`csdx`).

---

## `csdx stacksmith:init`

Scaffold a starter models-as-code project structure.

```bash
csdx stacksmith:init
csdx stacksmith:init --dir ./my-models-project
csdx stacksmith:init --dir ./my-models-project --yes --ci
```

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--dir` | | `string` | prompted | Target directory to scaffold |
| `--force` | | `boolean` | `false` | Overwrite existing files |
| `--yes` | `-y` | `boolean` | `false` | Accept the default target directory |
| `--ci` | | `boolean` | `false` | Disable prompts |
| `--json` | | `boolean` | `false` | Machine-readable JSON output |

**What it creates:**
- `contentstack.stacksmith.config.ts`
- `src/models/index.ts` (registry)
- Example content type and global field files
- `package.json` with DSL dependency
- `tsconfig.json`

---

## `csdx stacksmith:build`

Compile TypeScript model definitions into normalized schema artifacts.

```bash
csdx stacksmith:build
csdx stacksmith:build --cwd /path/to/project
csdx stacksmith:build --config ./contentstack.stacksmith.config.ts --json
```

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | | `string` | auto-detected | Path to `contentstack.stacksmith.config.ts` |
| `--cwd` | | `string` | `.` | Working directory for resolving project files |
| `--out-dir` | | `string` | from config | Override the config output directory |
| `--ci` | | `boolean` | `false` | Disable prompts |
| `--json` | | `boolean` | `false` | Machine-readable JSON output |

**Produces:**
- `schema.json` — normalized entity definitions with fields, dependencies, and ordering
- `manifest.json` — build metadata (compiler version, source files, schema hash)

**Safety:** Local-only operation. Does not contact any remote stack.

---

## `csdx stacksmith:diff`

Show a human-readable or JSON diff between local models and a target stack.

```bash
# Local-only diff (compares build output)
csdx stacksmith:diff

# Remote diff against a stack
csdx stacksmith:diff --stack blt123abc --token-alias my-stack

# Write diff to file
csdx stacksmith:diff --stack blt123abc --token-alias my-stack --output diff.json --json
```

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | | `string` | auto-detected | Path to config |
| `--cwd` | | `string` | `.` | Working directory |
| `--out-dir` | | `string` | from config | Override output directory |
| `--stack` | `-s` | `string` | — | Stack API key for remote compare |
| `--token-alias` | `-t` | `string` | — | Management token alias |
| `--branch` | | `string` | — | Contentstack branch name |
| `--region` | `-r` | `string` | — | Region alias |
| `--output` | | `string` | — | Write the diff JSON to a file |
| `--ci` | | `boolean` | `false` | Disable prompts |
| `--json` | | `boolean` | `false` | Machine-readable JSON output |

---

## `csdx stacksmith:plan`

Create a dependency-aware plan by comparing local models to a target stack.

```bash
# Local-only plan
csdx stacksmith:plan

# Plan against a remote stack
csdx stacksmith:plan --stack blt123abc --token-alias my-stack

# Plan with branch
csdx stacksmith:plan --stack blt123abc --token-alias my-stack --branch develop

# Write plan to file
csdx stacksmith:plan --stack blt123abc --token-alias my-stack --output plan.json
```

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | | `string` | auto-detected | Path to config |
| `--cwd` | | `string` | `.` | Working directory |
| `--out-dir` | | `string` | from config | Override output directory |
| `--stack` | `-s` | `string` | — | Stack API key for remote compare |
| `--token-alias` | `-t` | `string` | — | Management token alias |
| `--branch` | | `string` | — | Contentstack branch name |
| `--region` | `-r` | `string` | — | Region alias |
| `--output` | | `string` | — | Write the plan JSON to a file |
| `--ci` | | `boolean` | `false` | Disable prompts |
| `--json` | | `boolean` | `false` | Machine-readable JSON output |

**Produces:**
- `plan.json` — dependency-ordered list of operations with risk levels

---

## `csdx stacksmith:apply`

Safely apply low-risk additive model changes to a Contentstack stack. Requires `--stack`.

```bash
csdx stacksmith:apply --stack blt123abc --token-alias my-stack
csdx stacksmith:apply --stack blt123abc --token-alias my-stack --branch develop
csdx stacksmith:apply --stack blt123abc --token-alias my-stack --yes --ci
```

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--config` | | `string` | auto-detected | Path to config |
| `--cwd` | | `string` | `.` | Working directory |
| `--out-dir` | | `string` | from config | Override output directory |
| `--stack` | `-s` | `string` | **required** | Stack API key |
| `--token-alias` | `-t` | `string` | — | Management token alias |
| `--branch` | | `string` | — | Contentstack branch name |
| `--region` | `-r` | `string` | — | Region alias |
| `--yes` | `-y` | `boolean` | `false` | Skip confirmation prompt |
| `--ci` | | `boolean` | `false` | Disable prompts |
| `--json` | | `boolean` | `false` | Machine-readable JSON output |

**Safety:**

Only low-risk additive operations are executed:
- Create content type
- Create global field
- Add new field to existing entity
- Low-risk metadata or reorder updates

Blocked operations (require manual intervention):
- Delete content type or global field
- Remove a field
- Change a field's type
- Change reference targets
- Tighten validations (e.g., making a field required)

---

## Common workflows

### Author → validate

```bash
# After editing model files
csdx stacksmith:build --cwd .
```

### Author → plan → apply

```bash
csdx stacksmith:build --cwd .
csdx stacksmith:plan --cwd . --stack blt123abc --token-alias my-stack
# Review the plan output
csdx stacksmith:apply --cwd . --stack blt123abc --token-alias my-stack
```

### CI pipeline

```bash
csdx stacksmith:build --cwd . --ci --json
csdx stacksmith:plan --cwd . --stack $STACK_KEY --token-alias $TOKEN --ci --json
csdx stacksmith:apply --cwd . --stack $STACK_KEY --token-alias $TOKEN --yes --ci --json
```

---

## Remote authentication

Remote commands (`plan`, `diff`, `apply`) use the parent Contentstack CLI's authentication. The plugin resolves region, CMA host, and token aliases through the installed `csdx` runtime. You must have a valid management token configured via `csdx auth:tokens:add` before using remote commands.
