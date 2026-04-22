# Internal Test Utils Package

Shared fixtures and helpers used by package and CLI tests in this monorepo.

This workspace package is private and exists only for local development and test sharing inside the monorepo.

## Public Exports

- Sample DSL fixtures: `authorModel`, `blogPostModel`, `seoModel`
- Compiled schema fixture: `sampleSchema`
- Stable JSON snapshot: `sampleSchemaSnapshot`
- Temporary filesystem helpers: `createTempDir`, `cleanupTempDir`

## Typical Usage

Use this package in tests when you want a small, realistic schema without rebuilding the same author/blog-post/SEO fixture set in every package.
