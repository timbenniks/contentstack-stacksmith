# Best Practices

## File organization

- **One entity per file.** Keep each content type and global field in its own file for clean diffs, easy navigation, and simple imports.
- **Separate directories** for content types (`content-types/`) and global fields (`global-fields/`).
- **Barrel file** (`index.ts`) that imports everything and exports a single `defineModels` call.

## Naming conventions

- Use **`snake_case`** for all UIDs (`blog_post`, `meta_title`, `is_featured`). This matches Contentstack's internal conventions.
- Use descriptive UIDs that reflect the content they hold. Prefer `publish_date` over `date1`.
- Titles are auto-generated from UIDs if you don't provide them, so choose UIDs that read well when converted (`meta_title` → "Meta Title").

## Field configuration

- **Mark non-translatable fields with `nonLocalizable: true`**. Slugs, URLs, SKUs, IDs, timestamps, and numeric settings usually shouldn't translate per-locale. Setting `nonLocalizable` makes the CMS show a single value across locales instead of forcing editors to translate them.
- **Reuse global fields as modular blocks** when the same block schema repeats across content types. Define the schema once as a `defineGlobalField(...)`, then reference it inside `modularBlocks({ blocks: [{ uid, title, globalFieldRef: "..." }] })`. Future edits to the global field propagate to every block that embeds it.
- **Use enum advanced mode** (`advanced: true` with `{ key, value }` pairs) when the editor-facing label differs from the stored value — e.g., `{ key: "United States", value: "US" }`.

## Version control

- **Commit your model definitions** to Git. This is the primary benefit — content model changes become reviewable, auditable, and reversible.
- **Consider committing `schema.json`** to make diffs visible in pull requests without running a build. The deterministic output ensures no false positives.
- **Add `.contentstack/models/plan.json`** and **`diff.json`** to `.gitignore` — these are ephemeral artifacts specific to a point-in-time comparison.

## Safety

- **Always run `stacksmith:plan` before `stacksmith:apply`** to preview changes and check for blocked operations.
- **Use `--json` in CI pipelines** for machine-readable output that can be parsed by downstream tools.
- **Start small.** Deploy a few content types first, verify they look correct in the Contentstack dashboard, then expand.
- **Handle blocked operations manually** through the Contentstack dashboard when you need to make destructive changes (Phase 1 limitation).

## Team workflow

- **Review model changes in PRs** just like code changes. The TypeScript definitions are readable and the compiled `schema.json` diffs clearly.
- **Use a staging stack** for testing model changes before applying to production.
- **Coordinate with content editors** when adding required fields or changing content types that have existing entries.
