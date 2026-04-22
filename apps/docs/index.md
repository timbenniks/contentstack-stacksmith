---
layout: home

hero:
  name: "Contentstack Stacksmith"
  text: "Content models as code."
  tagline: Define Contentstack content types and global fields in TypeScript. Diff against a live stack. Apply safe changes with one CLI command.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: DSL Reference
      link: /reference/dsl-api
    - theme: alt
      text: View on GitHub
      link: https://github.com/timbenniks/contentstack-stacksmith

features:
  - icon: 🧩
    title: TypeScript-first DSL
    details: Typed builders for every Contentstack field kind. Autocomplete, refactor, and validate your models like any other code.
  - icon: 🔍
    title: Deterministic schema artifacts
    details: Every build produces a canonical, sorted JSON schema. Diffs are stable, hashes are reproducible, and version control works like you'd expect.
  - icon: 🛡️
    title: Safe-by-default apply
    details: Destructive operations are detected and blocked. Only additive, low-risk changes run automatically. High-risk changes are reported for review.
  - icon: ⬇️
    title: Lossless stack import
    details: Pull an existing Contentstack stack down into DSL files. Every documented CMA property round-trips through import, diff, and apply.
  - icon: 🧱
    title: Reusable global fields
    details: Compose models from shared global fields. Modular blocks can reference a global field directly for single-source-of-truth block schemas.
  - icon: 🤖
    title: Agent-friendly
    details: Ships with Agent Skills so AI coding assistants can scaffold, import, review, and migrate your models with the same guardrails you use.
---

## Quick taste

```typescript
import { defineContentType, text, reference, globalField } from "@timbenniks/contentstack-stacksmith";

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

```bash
# Build, plan, and apply your models against a live stack
csdx stacksmith:build
csdx stacksmith:plan --stack blt123 --token-alias my-stack
csdx stacksmith:apply --stack blt123 --token-alias my-stack

# Or pull an existing stack down into DSL files
csdx stacksmith:import --cwd ./apps/website --stack blt123 --token-alias my-stack
```

## The packages

| Package | Purpose |
|---------|---------|
| `@timbenniks/contentstack-stacksmith` | TypeScript DSL plus schema normalization, diffing, planning, and validation helpers. |
| `@timbenniks/contentstack-stacksmith-cli` | Contentstack CLI plugin exposing `csdx stacksmith:*` commands. |

The lower-level workspace packages are internal and are not meant to be installed separately.
