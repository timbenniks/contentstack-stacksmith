# Configuration

## `contentstack.stacksmith.config.ts`

Your project configuration file. It must export a `ModelsConfig` object using `defineModelsConfig`.

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-website",             // Required: project identifier
  modelsEntry: "./src/models/index.ts",  // Default: "./src/models/index.ts"
  outDir: "./.contentstack/models",      // Default: "./.contentstack/models"
  strict: true,                          // Default: true
  region: "EU",                          // Optional: region override
  branch: "development",                 // Optional: branch override
  defaults: {                            // Optional: custom defaults
    defaultLocale: "en-us",
  },
});
```

### Full property reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `projectName` | `string` | **(required)** | Identifier for the project, used in manifest metadata and output formatting. |
| `modelsEntry` | `string` | `"./src/models/index.ts"` | Path to the barrel file that exports the `ModelRegistry`. Resolved relative to the config file location. |
| `outDir` | `string` | `"./.contentstack/models"` | Directory where build artifacts (`schema.json`, `manifest.json`, `plan.json`) are written. Resolved relative to the working directory. |
| `strict` | `boolean` | `true` | Enable strict schema validation during build. When `true`, all validation rules are applied. |
| `region` | `string` | — | Contentstack region override. Takes precedence over the CLI's configured region. Common values: `"NA"`, `"EU"`, `"AZURE-NA"`, `"AZURE-EU"`. |
| `branch` | `string` | — | Contentstack branch override. Takes precedence over the `--branch` CLI flag. |
| `defaults` | `Record<string, unknown>` | — | Arbitrary key-value pairs for custom use in your project. Not consumed by the framework directly. |

The configuration file is loaded at runtime using [jiti](https://github.com/unjs/jiti), so it can be real TypeScript — no separate compilation step is needed.

## Project structure convention

The recommended project structure follows the scaffolded layout:

```
your-project/
  contentstack.stacksmith.config.ts         # Project configuration
  src/
    models/
      index.ts                          # Model registry (barrel file)
      content-types/
        author.ts                       # One file per content type
        blog-post.ts
        product.ts
      global-fields/
        seo.ts                          # One file per global field
        address.ts
  .contentstack/
    models/
      schema.json                       # Generated: normalized schema
      manifest.json                     # Generated: build metadata
      plan.json                         # Generated: execution plan
      diff.json                         # Generated: raw diff
```

**Conventions:**

- One entity per file for readability and clean diffs.
- Use `snake_case` for entity and field UIDs (e.g., `blog_post`, `meta_title`).
- Separate directories for content types and global fields.
- The `.contentstack/` directory contains generated artifacts — add it to `.gitignore` or commit it, depending on your workflow.
