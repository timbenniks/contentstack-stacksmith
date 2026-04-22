# Getting Started

## Prerequisites

- **Node.js** >= 20
- **pnpm** (or npm/yarn)
- **Contentstack CLI** (`csdx`) installed globally
- A **Contentstack stack** with a **management token** (for remote operations)

Install the Contentstack CLI if you haven't already:

```bash
npm install -g @contentstack/cli
```

## Installation

Install the DSL package in your project:

```bash
npm install @timbenniks/contentstack-stacksmith
```

Link the CLI plugin to the Contentstack CLI:

```bash
csdx plugins:link @timbenniks/contentstack-stacksmith-cli
```

After linking, the `stacksmith:*` commands become available:

```bash
csdx stacksmith --help
```

## Scaffold a new project

The fastest way to get started is to scaffold a new project:

```bash
csdx stacksmith:init
```

You'll be prompted for a target directory (defaults to the current directory). The command creates the following file structure:

```
your-project/
  contentstack.stacksmith.config.ts    # Project configuration
  src/
    models/
      index.ts                     # Model registry (barrel file)
      content-types/
        author.ts                  # Example: Author content type
        blog-post.ts               # Example: Blog Post content type
      global-fields/
        seo.ts                     # Example: SEO global field
```

Let's look at each generated file:

**contentstack.stacksmith.config.ts** — Project configuration:

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "contentstack-stacksmith-project",
});
```

**src/models/index.ts** — The model registry that collects all definitions:

```typescript
import { defineModels } from "@timbenniks/contentstack-stacksmith";

import author from "./content-types/author";
import blogPost from "./content-types/blog-post";
import seo from "./global-fields/seo";

export default defineModels({
  contentTypes: [author, blogPost],
  globalFields: [seo],
});
```

**src/models/content-types/author.ts** — A simple content type:

```typescript
import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  fields: [text("name", { required: true })],
});
```

**src/models/content-types/blog-post.ts** — A content type with references and global fields:

```typescript
import {
  defineContentType,
  globalField,
  reference,
  text,
} from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

**src/models/global-fields/seo.ts** — A reusable global field:

```typescript
import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  fields: [text("meta_title"), text("meta_description")],
});
```

## Build your schema

Compile your TypeScript model definitions into normalized JSON artifacts:

```bash
csdx stacksmith:build
```

This produces two files in `.contentstack/models/`:

- **schema.json** — The normalized, deterministic schema representing all your content types and global fields
- **manifest.json** — Build metadata including a SHA-256 hash of the schema, compiler versions, and source file paths

The build step also validates your schema and reports any issues. If there are blocking validation errors (like duplicate UIDs or missing references), the command exits with code 1.

## Plan changes against a remote stack

Before applying changes, create a plan to see what would happen:

```bash
# Local-only plan (compares schema against an empty baseline)
csdx stacksmith:plan

# Plan against a remote Contentstack stack
csdx stacksmith:plan \
  --stack <your-stack-api-key> \
  --token-alias <your-token-alias> \
  --branch main
```

The plan shows every operation that would be executed, classified by risk level. It also generates a `plan.json` artifact with the full details.

## Apply changes

Once you're satisfied with the plan, apply the changes:

```bash
# Auth resolved from your csdx auth:login session, or pass --token-alias / --management-token explicitly:
csdx stacksmith:apply --stack <your-stack-api-key>

# Preview exactly what will happen without touching the stack:
csdx stacksmith:apply --stack <your-stack-api-key> --dry-run
```

The apply command:

1. Builds your schema
2. Fetches the current state of the remote stack
3. Creates a plan comparing local to remote
4. Checks that no operations are blocked
5. Prompts for confirmation (unless `--yes`, `--ci`, or `--dry-run` is passed)
6. Applies all low-risk operations in dependency order

If the plan contains any blocked or high-risk operations, the apply command aborts with an error message explaining what is blocked and why.

### Recovering from a partial failure

If an apply fails midway (e.g., the CMA returns an error on operation 10 of 30), the command writes `.contentstack/models/apply-state.json` recording which operations succeeded. Re-running `csdx stacksmith:apply` picks up where it left off — already-applied operations are skipped.

If you changed your DSL between runs, the state becomes stale and the command aborts with `StaleApplyStateError`. Discard the old state and start fresh:

```bash
csdx stacksmith:apply --stack <your-stack-api-key> --reset-state
```

## Import an existing stack

If you already have models in a Contentstack stack, you don't have to hand-write them. Point `stacksmith:import` at the stack and it scaffolds the entire DSL project for you:

```bash
csdx stacksmith:import \
  --cwd ./my-project \
  --stack <your-stack-api-key> \
  --token-alias <your-token-alias>
```

The import covers every documented CMA field property (references, modular blocks with global-field references, enum advanced mode, file extensions, JSON RTE plugins, taxonomies, and more) and enforces a parity check so the generated DSL reproduces the remote schema exactly. See the [`stacksmith:import` reference](/reference/cli#csdx-models-import) for the full coverage list.

## Where to go next

- [Core Concepts](./core-concepts.md) — how compile, diff, plan, and apply fit together.
- [Safety Model](./safety-model.md) — which operations are safe to apply vs. blocked.
- [DSL Reference](/reference/dsl-api) — every field builder and option.
- [CLI Reference](/reference/cli) — every command with flags, examples, and exit codes.
