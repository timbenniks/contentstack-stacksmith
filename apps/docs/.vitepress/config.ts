import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Contentstack Stacksmith",
  description:
    "TypeScript-first content models for Contentstack. Define content types and global fields as code, diff against live stacks, and apply safe changes with a single CLI command.",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#6554C0" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Contentstack Stacksmith" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "TypeScript-first content models for Contentstack. Import, diff, plan, and apply models as code.",
      },
    ],
  ],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "Reference", link: "/reference/dsl-api", activeMatch: "/reference/" },
      { text: "Examples", link: "/examples/basic-blog", activeMatch: "/examples/" },
      {
        text: "More",
        items: [
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
          { text: "Advanced Patterns", link: "/guide/advanced-patterns" },
          { text: "Best Practices", link: "/guide/best-practices" },
          { text: "Changelog", link: "https://github.com/timbenniks/contentstack-stacksmith/blob/main/CHANGELOG.md" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is Contentstack Stacksmith?", link: "/guide/introduction" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Concepts",
          items: [
            { text: "The Pipeline", link: "/guide/core-concepts" },
            { text: "Safety Model", link: "/guide/safety-model" },
          ],
        },
        {
          text: "Workflow",
          items: [
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Artifacts", link: "/guide/artifacts" },
          ],
        },
        {
          text: "Going Deeper",
          items: [
            { text: "Advanced Patterns", link: "/guide/advanced-patterns" },
            { text: "Best Practices", link: "/guide/best-practices" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "DSL API", link: "/reference/dsl-api" },
            { text: "CLI Commands", link: "/reference/cli" },
            { text: "Programmatic API", link: "/reference/programmatic-api" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "Basic Blog", link: "/examples/basic-blog" },
            { text: "E-commerce Catalog", link: "/examples/ecommerce" },
            { text: "Page Builder", link: "/examples/page-builder" },
            { text: "CI/CD Pipeline", link: "/examples/cicd" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/timbenniks/contentstack-stacksmith" },
    ],

    editLink: {
      pattern:
        "https://github.com/timbenniks/contentstack-stacksmith/edit/main/apps/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024 Tim Benniks",
    },

    outline: {
      level: [2, 3],
    },
  },
});
