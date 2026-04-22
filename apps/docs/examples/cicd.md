# CI/CD Pipeline

Integrate content model changes into your CI/CD workflow for safe, automated deployments.

## GitHub Actions workflow

```yaml
name: Content Models

on:
  push:
    branches: [main]
    paths:
      - 'src/models/**'
      - 'contentstack.stacksmith.config.ts'
  pull_request:
    paths:
      - 'src/models/**'
      - 'contentstack.stacksmith.config.ts'

jobs:
  validate:
    name: Build & Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx csdx stacksmith:build --json
        # Exits with code 1 if there are blocking validation findings

  plan:
    name: Plan Changes (Staging)
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'pull_request'
    env:
      CS_AUTHTOKEN: ${{ secrets.CONTENTSTACK_MANAGEMENT_TOKEN_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: |
          npx csdx stacksmith:plan \
            --stack ${{ secrets.CONTENTSTACK_STACK_STAGING }} \
            --region EU \
            --json --ci
        # Review the plan output in the PR workflow logs

  apply-staging:
    name: Apply to Staging
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main'
    env:
      CS_AUTHTOKEN: ${{ secrets.CONTENTSTACK_MANAGEMENT_TOKEN_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: |
          npx csdx stacksmith:apply \
            --stack ${{ secrets.CONTENTSTACK_STACK_STAGING }} \
            --region EU \
            --yes --ci --json
```

## Multi-environment strategy

1. **Pull requests** — Run `stacksmith:build` to validate, and `stacksmith:plan` against staging to preview changes.
2. **Merge to main** — Automatically `stacksmith:apply` to staging.
3. **Production deploys** — Run `stacksmith:apply` against production manually or with a separate approval step.

## Environment variables for token resolution

| Variable | Description |
|----------|-------------|
| `CS_AUTHTOKEN` | Contentstack management token |
| `CONTENTSTACK_MANAGEMENT_TOKEN` | Alternative management token variable |
