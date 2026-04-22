# Migration Strategies Reference

Detailed strategies for every type of blocked operation, with step-by-step instructions and rollback guidance.

---

## Operation risk levels

The CLI classifies plan operations by risk:

| Risk | Meaning | CLI behavior |
|------|---------|-------------|
| Low | Safe additive change | Auto-applied by `stacksmith:apply` |
| High | Potentially breaking change | Blocked by `stacksmith:apply` |
| Blocker | Destructive or incompatible change | Blocked by `stacksmith:apply` |

### Low-risk operations (auto-applied)

- Create a new content type
- Create a new global field
- Add a new field to an existing entity
- Reorder fields (metadata-only change)

### Blocked operations (require migration)

- Delete content type
- Delete global field
- Remove a field from an entity
- Change a field's type (data_type)
- Change reference field targets
- Make an optional field required (tighten validation)
- Change a field's unique constraint

---

## Strategy: Field rename

**Blocked because:** CLI sees removal of old field + addition of new field. No data migration.

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Add new field with new UID to DSL | `stacksmith:apply` | Yes (remove field) |
| 2 | Copy data from old field to new field for all entries | CMA API / SDK | Yes (delete copied data) |
| 3 | Verify data integrity — compare old and new field values | CMA API / manual | N/A |
| 4 | Update frontend code to read from new field | Code deploy | Yes (revert deploy) |
| 5 | Remove old field | Contentstack UI | No (data lost) |
| 6 | Remove old field from DSL, run `stacksmith:build` | Local | Yes |

### Rollback

- Before step 5: remove the new field, revert frontend code.
- After step 5: data in old field is lost. Restore from backup.

### Data copy script pattern

```ts
import Contentstack from "@contentstack/management";

const client = Contentstack.client({ authtoken: "..." });
const stack = client.stack({ api_key: "...", branch_alias: "..." });

const entries = await stack.contentType("blog_post").entry().query().find();

for (const entry of entries.items) {
  if (entry.old_field_uid) {
    await entry.update({ new_field_uid: entry.old_field_uid });
  }
}
```

---

## Strategy: Field type change

**Blocked because:** Data in the old type may not be compatible with the new type.

### Type compatibility matrix

| From | To | Safe? | Notes |
|------|----|-------|-------|
| text | json | Yes | Wrap in JSON string |
| number | text | Yes | Convert to string |
| text | number | Risky | Non-numeric values fail |
| boolean | text | Yes | "true" / "false" |
| text | boolean | Risky | Only works for "true"/"false" |
| date | text | Yes | ISO string |
| text | date | Risky | Must be valid ISO date |
| group | modular_blocks | No | Structural incompatibility |
| reference | text | No | Loses relationship |

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Add temporary field with new type | `stacksmith:apply` | Yes |
| 2 | Transform and copy data | CMA API / SDK | Yes |
| 3 | Verify transformed data | Manual / script | N/A |
| 4 | Update frontend code | Code deploy | Yes |
| 5 | Remove old field | Contentstack UI | No |
| 6 | Rename temp field to original UID (optional) | Follow field rename strategy | See above |

---

## Strategy: Content type deletion

**Blocked because:** Deletes all entries and breaks inbound references.

### Pre-flight checks

1. Search all model files for `reference(..., { to: ["<uid_to_delete>"] })`.
2. Count entries: `GET /v3/content_types/<uid>/entries?count=true`.
3. Check if any published entries exist.

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Remove inbound references from other content types | Contentstack UI or migration | Yes (re-add reference) |
| 2 | Unpublish all entries of this content type | CMA API / UI | Yes (republish) |
| 3 | Export entries for backup | CMA API | N/A |
| 4 | Delete all entries | CMA API / UI | No |
| 5 | Delete the content type | Contentstack UI | No |
| 6 | Remove from DSL registry and delete file | Local | Yes |
| 7 | Run `stacksmith:build` | Local | N/A |

---

## Strategy: Field deletion

**Blocked because:** Permanently deletes field data across all entries.

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Verify no frontend code reads this field | Code search | N/A |
| 2 | Export field data for backup | CMA API | N/A |
| 3 | Remove the field | Contentstack UI | No |
| 4 | Remove from DSL definition | Local | Yes |
| 5 | Run `stacksmith:build` | Local | N/A |

---

## Strategy: Tighten required constraint

**Blocked because:** Existing entries may have empty values.

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Query entries where field is empty | CMA API | N/A |
| 2 | Backfill empty entries with default or correct values | CMA API / UI | Yes |
| 3 | Verify no entries have empty values | CMA API | N/A |
| 4 | Set field to required | Contentstack UI | Yes (set back to optional) |
| 5 | Update DSL to `required: true` | Local | Yes |
| 6 | Run `stacksmith:build` | Local | N/A |

### Finding empty entries

```
GET /v3/content_types/<uid>/entries?query={"<field_uid>":{"$exists":false}}
```

---

## Strategy: Change reference targets

**Blocked because:** Entries may reference content types being removed from the target list.

### Steps

| # | Action | Method | Reversible |
|---|--------|--------|-----------|
| 1 | Query entries using this reference field | CMA API | N/A |
| 2 | Identify entries pointing to removed target types | Script / manual | N/A |
| 3 | Update those entries to point to valid targets | CMA API / UI | Depends |
| 4 | Update reference targets | Contentstack UI | Yes |
| 5 | Update DSL definition | Local | Yes |
| 6 | Run `stacksmith:build` | Local | N/A |

---

## General migration tips

### Use Contentstack branches

If available, perform migrations on a branch first:

1. Create a branch from main.
2. Apply the migration on the branch.
3. Verify everything works.
4. Merge the branch.

### Coordinate with team

- Notify content editors before starting.
- Consider a content freeze during migration.
- Document the migration steps and timeline.

### Automation vs. manual

- **Automate** data migrations (copying field values, backfilling) — they're repetitive and error-prone manually.
- **Keep manual** structural changes (deleting fields, changing types) — they need human judgment and the Contentstack UI provides safety confirmations.
