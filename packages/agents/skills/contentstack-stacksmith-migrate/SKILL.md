---
name: contentstack-stacksmith-migrate
description: Generates step-by-step migration strategies when stacksmith:plan shows blocked or high-risk operations. Use when asked to rename fields, change field types, delete entities, or handle any breaking model change that the CLI cannot apply automatically.
license: MIT
---

# Contentstack Stacksmith Migrate

Read this reference for detailed strategies:

- [Migration strategies](references/migration-strategies.md)

## Use this skill when

- `stacksmith:plan` shows blocked or high-risk operations
- the user wants to rename a field UID on a live stack
- the user wants to change a field's type
- the user wants to delete a content type or global field
- the user wants to remove a field from a live content type
- the user wants to make an optional field required (with existing entries)
- the user wants to change reference targets on a live field
- the user needs a safe, ordered migration plan for breaking schema changes

---

## Why migrations are needed

The `stacksmith:apply` command only executes low-risk additive operations:
- Create content type or global field
- Add a new field to an existing entity
- Low-risk metadata updates

Everything else is blocked to protect live content. Breaking changes require a manual, ordered migration strategy that accounts for existing entries and downstream consumers.

---

## Workflow: Generate a migration plan

### Steps

1. **Read the plan output**:
   - Run `csdx stacksmith:plan --stack <api_key> --token-alias <alias>` if not already done.
   - Identify all blocked and high-risk operations.

2. **Classify each blocked operation** by type (see strategies below).

3. **Generate ordered migration steps**:
   - Each step should be atomic and independently safe.
   - Steps must be ordered so dependencies are respected.
   - Include rollback guidance for each step.

4. **Output as a checklist** the user can follow:
   - Clearly mark which steps are automated (CLI/API) vs. manual (Contentstack UI).
   - Include the specific CMA API calls or UI actions needed.

5. **Warn about risks**:
   - Data loss potential
   - Downtime or broken references
   - Impact on frontend consumers

---

## Migration scenarios

### Rename a field UID

**Why it's blocked:** The CLI sees this as a field removal + field addition. The old field's data does not migrate automatically.

**Strategy:**
1. Add the new field to the content type (via DSL + `stacksmith:apply`).
2. Migrate content: copy data from the old field to the new field for all entries (via CMA API or Contentstack UI bulk edit).
3. Update frontend code to use the new field UID.
4. Remove the old field (manual, via Contentstack UI).
5. Update the DSL definition to remove the old field.
6. Run `stacksmith:build` to validate.

**Risk:** Data loss if step 2 is skipped. Frontend breakage if step 3 is skipped.

---

### Change a field type

**Why it's blocked:** Changing a field's data type can corrupt existing data.

**Strategy:**
1. Add a new field with the desired type and a temporary UID (via DSL + `stacksmith:apply`).
2. Migrate content: transform and copy data from the old field to the new field.
3. Update frontend code to use the new field.
4. Remove the old field (manual, via Contentstack UI).
5. Optionally rename the new field to the original UID (see "Rename a field UID" above).
6. Update the DSL definition.

**Risk:** Data transformation may lose precision (e.g., number → text is safe, text → number may fail for non-numeric values).

---

### Delete a content type

**Why it's blocked:** Deleting a content type removes all its entries and breaks inbound references.

**Strategy:**
1. Find all content types that reference this type (search for `reference({ to: ["<uid>"] })`).
2. Remove or update those reference fields first (manual if live).
3. Delete or archive all entries of this content type (via CMA API or Contentstack UI).
4. Delete the content type (manual, via Contentstack UI).
5. Remove the content type from the DSL registry.
6. Run `stacksmith:build` to validate.

**Risk:** Permanent data loss. All entries are deleted. Inbound references break if not removed first.

---

### Delete a field

**Why it's blocked:** Removing a field deletes all stored data for that field across all entries.

**Strategy:**
1. Verify no frontend code depends on this field.
2. Optionally export the field's data for backup (via CMA API).
3. Remove the field (manual, via Contentstack UI).
4. Remove the field from the DSL definition.
5. Run `stacksmith:build` to validate.

**Risk:** Permanent data loss for that field across all entries.

---

### Make a field required

**Why it's blocked:** Existing entries may have empty values for this field, which would violate the new constraint.

**Strategy:**
1. Query all entries where this field is empty (via CMA API: `GET /v3/content_types/<uid>/entries`).
2. Backfill empty entries with a default value or prompt content editors to fill them.
3. Once all entries have values, update the field to `required: true` (via Contentstack UI or a separate `stacksmith:apply` if supported).
4. Update the DSL definition.

**Risk:** Entries with empty values will fail validation after the constraint is applied.

---

### Change reference targets

**Why it's blocked:** Existing entries may reference content types that are being removed from the target list.

**Strategy:**
1. Query all entries that use this reference field (via CMA API).
2. Check if any entries reference content types being removed from the target list.
3. Update those entries to reference valid targets.
4. Update the reference field targets (manual, via Contentstack UI).
5. Update the DSL definition.

**Risk:** Orphaned references if entries point to removed target types.

---

## Safety guidelines

- **Always back up** before starting a migration. Export entries via CMA API or Contentstack UI.
- **Test on a branch first** if using Contentstack branches. Apply the migration on a branch, verify, then merge.
- **Coordinate with content editors** — migrations may temporarily break editing workflows.
- **Update frontend code** between migration steps to avoid broken pages.
- **One migration at a time** — don't batch multiple breaking changes. Complete one, verify, then start the next.
- **Document what you did** — keep a migration log for the team.

---

## CMA API patterns for content migration

### List all entries for a content type

```
GET /v3/content_types/<content_type_uid>/entries
Headers: api_key, authorization, branch (optional)
```

### Update an entry's field value

```
PUT /v3/content_types/<content_type_uid>/entries/<entry_uid>
Headers: api_key, authorization, Content-Type: application/json
Body: { "entry": { "<field_uid>": "<new_value>" } }
```

### Delete all entries of a content type

```
# For each entry:
DELETE /v3/content_types/<content_type_uid>/entries/<entry_uid>
Headers: api_key, authorization
```

Note: Use the `contentstack-platform-sdk` or `@contentstack/management` SDK for programmatic migrations rather than raw API calls.
