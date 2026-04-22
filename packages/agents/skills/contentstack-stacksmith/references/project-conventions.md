# Project Conventions

These are default conventions for projects using `@timbenniks/contentstack-stacksmith`. They are not hard requirements. Always prefer the actual project structure over these defaults.

## Default project layout

```text
contentstack.stacksmith.config.ts
src/
  models/
    index.ts                    # Registry / barrel file
    content-types/
      author.ts
      blog-post.ts
    global-fields/
      seo.ts
```

## Config resolution

Read `contentstack.stacksmith.config.ts` first.

Important config values:

| Key | Default | Description |
|-----|---------|-------------|
| `projectName` | — | Project identifier |
| `modelsEntry` | `./src/models/index.ts` | Path to the models registry file |
| `outDir` | `./.contentstack/models` | Output directory for build artifacts |
| `strict` | `true` | Enable strict validation rules |

Resolve `modelsEntry` relative to the config file.

Then inspect the resolved registry file to infer:

- where content types live
- where global fields live
- how imports are formatted
- whether the project uses default exports, grouped exports, or mixed registry styles

## Registry shape

A common registry pattern:

```ts
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
```

Keep the existing project style when editing. Do not rewrite a project into this shape if it already uses another valid structure.

## File naming

- Use kebab-case for file names: `blog-post.ts`, `global-fields/seo.ts`.
- Use snake_case for UIDs: `blog_post`, `meta_title`.
- One entity per file unless the project groups them.

## Build artifacts

After `csdx stacksmith:build`, the `outDir` contains:

### `schema.json`

Normalized entity definitions. Each entity includes:
- `id` — format: `content_type:{uid}` or `global_field:{uid}`
- `kind` — `content_type` or `global_field`
- `uid`, `title`, `description`
- `fields` — array of compiled fields with types, options, and dependencies
- `dependencies` — array of entity references this entity depends on

### `manifest.json`

Build metadata:
- Compiler and package versions
- Source file list
- Schema hash (for change detection and CI caching)

### `plan.json` (after `stacksmith:plan`)

Dependency-ordered operation list:
- Each operation has `type` (create, update, delete), `target`, `risk`, and `reason`
- Operations are ordered so dependencies are satisfied first (e.g., global fields before content types that use them)

## Dependency graph

The compiler automatically tracks dependencies:
- `reference("author", { to: ["author"] })` creates a dependency on `content_type:author`
- `globalField("seo", { ref: "seo" })` creates a dependency on `global_field:seo`

The plan respects these dependencies when ordering operations. Referenced entities are always created or updated before their dependents.

## Validation workflow

Preferred validation command:

```bash
csdx stacksmith:build --cwd <project-root>
```

If the project exposes a wrapper script or uses a package-manager-specific invocation, prefer the existing local convention.

## Remote workflow

Use planning only when the user wants remote comparison or rollout preview. Do not jump from authoring straight to apply.

Preferred sequence for deploying changes:

1. `stacksmith:build` — compile and validate locally
2. `stacksmith:plan` — compare against remote stack
3. Review risks — check for blocked or high-risk operations
4. `stacksmith:apply` — execute safe operations

## Safety notes

- `stacksmith:build` is safe and local.
- `stacksmith:plan` may compare against a remote stack when stack flags are provided.
- `stacksmith:diff` is read-only against the remote stack.
- `stacksmith:apply` changes remote Contentstack state and should only be used on explicit request.

## Editing guidance

- Prefer adding a new file over stuffing multiple entities into one file, unless the project already groups them.
- Reuse existing global fields when they match the requested shape.
- When adding references, verify the target content type already exists or create it in the same change.
- Infer directories from current imports before creating new folders.
- After editing, rerun a build and fix any duplicate UID or missing reference errors.
