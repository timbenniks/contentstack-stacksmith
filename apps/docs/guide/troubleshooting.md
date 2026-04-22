# Troubleshooting

## Common errors

### "--stack is required for apply."

The `stacksmith:apply` command requires the `--stack` flag to identify which Contentstack stack to modify.

```bash
csdx stacksmith:apply --stack <your-stack-api-key> --token-alias <your-alias>
```

### "`stacksmith:plan` requires --stack when using --token-alias, --branch, or --region."

Remote compare flags only work when `--stack` is present. Without it, `stacksmith:plan` stays in local-only mode.

```bash
csdx stacksmith:plan --stack <your-stack-api-key> --token-alias <your-alias>
```

### "`stacksmith:diff` requires --stack when using --token-alias, --branch, or --region."

Remote compare flags only work when `--stack` is present. Without it, `stacksmith:diff` stays in local-only mode.

```bash
csdx stacksmith:diff --stack <your-stack-api-key> --token-alias <your-alias>
```

### "No Contentstack credentials found."

Emitted in `--ci` mode when no auth source is configured. Provide one of:

- `--management-token <token>` (flag)
- `--token-alias <alias>` (from `csdx auth:tokens:add`)
- `CS_AUTHTOKEN=<token>` or `CONTENTSTACK_MANAGEMENT_TOKEN=<token>` (environment)

For interactive use (no `--ci`), run `csdx auth:login` or `csdx auth:login --oauth` first, or let the command prompt you for a token.

### "Compile failed: N forward reference(s) could not be resolved."

A `globalField()` or `reference()` points at a UID that isn't defined in your model registry. The error message lists every offending reference at once, e.g. `blog_post.seo references missing global field "seo_meta"`. Either define the missing entity (`defineGlobalField("seo_meta", ...)` / `defineContentType("author", ...)`) or remove the reference. This check now runs at compile time (`stacksmith:build`) so these errors surface before `plan` or `apply`.

### "The local schema has changed since the last apply."

Also known as `StaleApplyStateError`. A previous `stacksmith:apply` or `stacksmith:promote` failed partway through and wrote `.contentstack/models/apply-state.json`. The file's schema hash no longer matches your current DSL, which means retrying would skip operations that are now different.

Two paths:

- Revert your DSL to what it was when the failure happened, then re-run the apply — the resume picks up where it left off.
- Discard the old state and re-plan from scratch: `csdx stacksmith:apply --reset-state` (or `csdx stacksmith:promote --reset-state`).

### "Cannot rename {old} → {new}: both uids already exist on the remote."

Field rename plan op (from `previousUid`) is blocked because both the old and new field UID are already present on the content type — usually the sign of a botched prior apply where only half the rename landed. Remove one of the fields via the Contentstack UI (pick whichever is correct) and re-run the apply.

### "Field \"...\" has previousUid but is nested inside a group or modular block."

`previousUid` is only supported on top-level fields of a content type or global field. Contentstack's CMA does not support in-place renames of sub-fields inside `group()` or `modularBlocks()`. Options: remove the `previousUid`, or rename by removing + re-adding the nested field (with expected data-loss implications for populated entries).

### "Build completed with blocking validation findings."

Your schema has structural errors that must be fixed before proceeding. Run `csdx stacksmith:build --json` to see the full list of findings. Common causes:

- Duplicate entity UIDs (two content types or global fields with the same UID)
- Duplicate field UIDs within a single entity
- Reference field pointing to a content type that doesn't exist in your schema
- Global field reference pointing to a global field that doesn't exist in your schema

### "Apply aborted because the plan contains blocked changes."

The plan includes destructive or breaking changes that are not allowed in Phase 1. Review the plan output to see which operations are blocked. Common blocked operations:

- Deleting a content type or global field
- Removing a field from an existing content type
- Changing a field's type (e.g., `text` → `number`)
- Changing a reference field's target content types
- Making an optional field required

To proceed, either remove the blocked changes from your definitions or handle them manually through the Contentstack dashboard.

### "Duplicate definition detected for {entityType}:{uid}."

Two model definitions share the same entity type and UID. Each content type and global field must have a unique UID within its entity type. Check your model files for duplicate UIDs.

### "Import target already contains import-managed model files."

`stacksmith:import` refuses to overwrite files from a prior import. Re-run with `--force` to refresh them, which deletes the previously tracked managed files before regenerating.

### "Cannot safely refresh existing generated files because no prior import manifest was found."

The target directory has import-managed files but no `.contentstack/models/import-manifest.json` to describe them. The command won't delete files it can't prove it created. Either restore the manifest, delete the generated files manually, or import into a fresh directory.

### "Imported models did not reach parity with the source stack."

The generated DSL, after `stacksmith:build`, still differs from the source stack. This is typically caused by a CMA field property the pipeline doesn't cover yet; the error message lists `residualCategories` (`unsupported field mapping`, `metadata mismatch`, `generator mismatch`) to help localize the drift. Re-run with `--json` to get the full diff payload.

### `ERR_PNPM_FETCH_404` after `pnpm install` in a freshly-imported package

The generated `package.json` pins a concrete version for `@timbenniks/contentstack-stacksmith`. Inside a pnpm workspace, `pnpm install` expects `workspace:*`. `stacksmith:import` detects this by walking up from `--cwd` looking for `pnpm-workspace.yaml`, a `package.json` with `workspaces`, or `lerna.json`, and switches the dependency to `workspace:*` automatically. If the monorepo marker lives outside the walk path, edit the dependency manually.

---

## Validation codes reference

| Code | Level | Description |
|------|-------|-------------|
| `DUPLICATE_UID` | blocker | Two entities or fields share the same UID |
| `MISSING_REFERENCE_TARGET` | blocker | A reference field points to a content type not defined in the schema |
| `MISSING_GLOBAL_FIELD` | blocker | A `global_field` field, OR a modular block that uses `globalFieldRef`, points at a global field UID that isn't defined in the schema |
| `EMPTY_MODULAR_BLOCKS` | medium | A modular_blocks field has no blocks defined |
| `DESTRUCTIVE_CHANGE` | blocker | An operation that would delete an entity or remove a field |
| `BREAKING_FIELD_MUTATION` | blocker | A field update that changes the field type, reference targets, or tightens required validation |
| `RISKY_REQUIRED_FIELD` | high | A new required field is being added to an existing entity |
| `SAFE_FIELD_UPDATE` | low | A non-breaking field update (display name, description, etc.) |
| `SAFE_ADDITIVE_CHANGE` | low | A new optional field is being added |
| `SAFE_ENTITY_CHANGE` | low | A new entity is being created, or entity metadata is being updated |
| `PLAN_BLOCKED` | blocker | The overall plan contains one or more blocked operations |
| `HIGH_RISK_OPERATIONS` | high | The overall plan contains one or more high-risk operations |
