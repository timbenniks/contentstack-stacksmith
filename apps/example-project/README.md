# Example Project

This is the smallest end-to-end sample in the monorepo. It shows how to define models with the DSL and run the CLI workflow against them.

It currently contains:

- `author` content type with `name` and `bio`
- `blog_post` content type with `title`, `slug`, `author`, and embedded `seo`
- `seo` global field with `meta_title` and `meta_description`

## Files to Look At

- [`contentstack.stacksmith.config.ts`](./contentstack.stacksmith.config.ts)
- [`src/models/index.ts`](./src/models/index.ts)
- [`src/models/content-types/author.ts`](./src/models/content-types/author.ts)
- [`src/models/content-types/blog-post.ts`](./src/models/content-types/blog-post.ts)
- [`src/models/global-fields/seo.ts`](./src/models/global-fields/seo.ts)

## Local Workflow

From the repo root:

```bash
pnpm install
npm run build
```

Then either link the CLI plugin:

```bash
cd packages/cli
csdx plugins:link .
cd ../..
```

Or run commands directly through the workspace package:

```bash
cd packages/cli
pnpm exec csdx stacksmith:build --cwd ../../apps/example-project
cd ../..
```

Once the plugin is available, this project supports:

```bash
csdx stacksmith:build --cwd apps/example-project
csdx stacksmith:plan --cwd apps/example-project
csdx stacksmith:diff --cwd apps/example-project
csdx stacksmith:docs --cwd apps/example-project
```

You can also use the package scripts from this app directory:

```bash
pnpm build-models
pnpm plan-models
pnpm diff-models
```

## Generated Artifacts

After `stacksmith:build`:

- `apps/example-project/.contentstack/models/schema.json`
- `apps/example-project/.contentstack/models/manifest.json`

After `stacksmith:plan`:

- `apps/example-project/.contentstack/models/plan.json`

After `stacksmith:diff`:

- `apps/example-project/.contentstack/models/diff.json`

After `stacksmith:docs`:

- `apps/example-project/.contentstack/models/models.md`

## Compare Against a Real Stack

```bash
csdx stacksmith:plan \
  --cwd apps/example-project \
  --stack <stack_api_key> \
  --token-alias <management_token_alias>
```

## Apply Safe Changes

```bash
csdx stacksmith:apply \
  --cwd apps/example-project \
  --stack <stack_api_key> \
  --token-alias <management_token_alias>
```

`stacksmith:apply` remains intentionally conservative and aborts when the computed plan contains blocked operations.
