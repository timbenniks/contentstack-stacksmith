# Basic Blog

A complete blog setup with authors, posts, and reusable SEO metadata.

## `contentstack.stacksmith.config.ts`

```typescript
import { defineModelsConfig } from "@timbenniks/contentstack-stacksmith";

export default defineModelsConfig({
  projectName: "my-blog",
});
```

## `src/models/global-fields/seo.ts`

```typescript
import { defineGlobalField, text } from "@timbenniks/contentstack-stacksmith";

export default defineGlobalField("seo", {
  title: "SEO",
  description: "SEO metadata reused across content types.",
  fields: [
    text("meta_title"),
    text("meta_description"),
  ],
});
```

## `src/models/content-types/author.ts`

```typescript
import { defineContentType, text } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("author", {
  title: "Author",
  description: "Blog post authors.",
  fields: [
    text("name", { required: true }),
    text("bio"),
  ],
});
```

## `src/models/content-types/blog-post.ts`

```typescript
import { defineContentType, text, date, boolean, reference, globalField } from "@timbenniks/contentstack-stacksmith";

export default defineContentType("blog_post", {
  title: "Blog Post",
  description: "A blog post with author attribution and SEO metadata.",
  fields: [
    text("title", { required: true }),
    text("slug", { required: true, unique: true }),
    text("excerpt", { description: "Short summary shown in blog listing pages." }),
    date("publish_date"),
    boolean("is_featured", { defaultValue: false }),
    reference("author", { to: ["author"] }),
    globalField("seo", { ref: "seo" }),
  ],
});
```

## `src/models/index.ts`

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

## Build and apply

```bash
# Build the schema
csdx stacksmith:build

# Preview what would change on the remote stack
csdx stacksmith:plan --stack blt123abc --token-alias my-stack

# Apply the changes
csdx stacksmith:apply --stack blt123abc --token-alias my-stack
```
