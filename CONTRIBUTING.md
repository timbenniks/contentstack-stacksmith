# Contributing

Thank you for your interest in contributing to contentstack-stacksmith!

## Setup

```bash
# Clone the repo
git clone <repo-url>
cd contentstack-stacksmith

# Install dependencies (requires pnpm 10.7.0+ and Node 20+)
pnpm install

# Build all packages
pnpm build

# Run all checks
pnpm typecheck
pnpm lint
pnpm test
```

## Monorepo Structure

| Package | Description |
|---------|-------------|
| `packages/core` | Normalized schema, diffing, dependency graph, planning |
| `packages/dsl` | TypeScript field builders and model definitions |
| `packages/validators` | Schema validation and breaking change detection |
| `packages/cli` | Contentstack CLI plugin (`csdx stacksmith:*`) |
| `packages/test-utils` | Shared test fixtures |
| `apps/example-project` | Dogfooding example project |

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Open a pull request

## Coding Standards

- TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- ESM for core/dsl/validators packages, CommonJS for CLI (oclif requirement)
- Use `import type` for type-only imports
- Add JSDoc to all new public API exports
- UIDs must match `^[a-z][a-z0-9_]*$`

## Testing

- **Core, DSL, Validators**: Vitest
- **CLI**: Mocha + @oclif/test
- Run all: `pnpm test`
- Run single package: `pnpm --filter @timbenniks/contentstack-stacksmith-core run test`

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include tests for new functionality
- Ensure all CI checks pass
- Update `CHANGELOG.md` for user-facing changes
