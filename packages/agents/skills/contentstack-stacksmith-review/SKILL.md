---
name: contentstack-stacksmith-review
description: Reviews Contentstack model definitions for quality, consistency, and best practices. Use when asked to review, audit, or lint content type and global field definitions for naming issues, missing fields, duplication, or structural problems.
license: MIT
---

# Contentstack Stacksmith Review

Read this reference before reviewing:

- [Review checklist](references/review-checklist.md)

## Use this skill when

- the user wants a review of their model definitions before committing
- the user wants to audit their content model for quality issues
- the user asks for best practice suggestions on their schema
- a PR includes model changes and needs review
- the user wants to find duplication or inconsistencies across models

---

## Workflow: Review model changes

### Steps

1. **Identify scope**:
   - If the user specifies files, review those files.
   - If the user asks for a general audit, find all model files by reading the registry (`src/models/index.ts` or the configured `modelsEntry`).
   - If reviewing a PR or recent changes, use `git diff` to identify changed model files.

2. **Read all model files in scope**, plus the registry and config.

3. **Run the review checklist** against each entity and field. See [review-checklist.md](references/review-checklist.md) for all rules.

4. **Classify findings** by severity:
   - **Error**: will cause build failures or runtime issues (duplicate UIDs, missing references)
   - **Warning**: likely problems (missing required constraints on slug fields, overly broad references)
   - **Suggestion**: improvements (fields that could be global fields, missing descriptions)

5. **Report findings** grouped by severity, with:
   - The file and entity where the issue was found
   - What the issue is
   - Why it matters
   - How to fix it

6. **Optionally run `stacksmith:build`** to confirm build-level validation passes.

---

## Review categories

### Naming

- UIDs must be `snake_case`.
- UIDs should be descriptive and consistent across the project.
- Content type UIDs should be singular nouns (e.g., `blog_post` not `blog_posts`).
- Field UIDs should describe the data they hold.
- Avoid abbreviations unless they are universally understood (e.g., `url`, `cta`).

### Required fields

- Content types should have at least one required field (usually `title`).
- Fields named `title` or `name` should typically be `required: true`.
- Fields named `slug` should typically be `required: true` and `unique: true`.
- Singleton content types should still have meaningful required fields.

### References

- Reference fields should target specific content types, not overly broad lists.
- All reference targets must exist in the registry.
- Self-references (e.g., `category` referencing `category`) should be intentional.
- Avoid circular reference chains that could cause infinite loops in queries.

### Global field reuse

- If the same set of fields (2+ fields with matching UIDs and types) appears in multiple content types, suggest extracting them into a global field.
- Common candidates: SEO fields, social links, CTA groups, address blocks.
- Unused global fields (defined but not referenced by any content type) should be flagged.

### Structure

- Content types with more than 20 fields may be too complex — suggest splitting or using groups.
- Modular blocks with only one block definition may be better as a group.
- Deeply nested groups (3+ levels) are hard to manage — suggest flattening.
- Singleton content types should be used for site-wide settings, not regular content.

### Completeness

- Entities without a `description` lose discoverability for content editors.
- Fields without descriptions are harder for editors to understand.
- Content types without an `options` block default to `singleton: false`, which is usually correct but should be intentional.

### Dependencies

- The dependency graph should be acyclic (no circular references between content types via references and global fields).
- Content types that reference many other types create tight coupling — consider if all references are necessary.

---

## Output format

Present findings as a structured report:

```
## Review: <file or entity name>

### Errors
- **Duplicate UID `hero`** in `page.ts` — two fields share the same UID. Rename one.

### Warnings
- **`slug` field is not unique** in `blog_post.ts` — slugs should have `unique: true` to prevent URL collisions.
- **Overly broad reference** in `page.ts` — `related_content` targets 5 content types. Consider narrowing.

### Suggestions
- **Extract global field** — `meta_title` + `meta_description` appear in 3 content types. Extract to a `seo` global field.
- **Missing description** on `author.ts` — add a description to help content editors.
```

---

## Review scope options

### Single file review
Review one model file for issues.

### Full audit
Read all model files from the registry and review the entire schema holistically. This catches cross-entity issues like duplication and reference problems.

### Diff review
Review only changed files from a git diff. Focus on whether the changes introduce new issues, not pre-existing problems in unchanged code.
