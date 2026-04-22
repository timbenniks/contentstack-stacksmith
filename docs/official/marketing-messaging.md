# Contentstack Stacksmith — Messaging Guide

**Audience:** Marketing, developer relations, sales engineering, leadership.
**Last updated:** 2026-04-22

This doc gives you the story, the one-liners, the audience-specific angles, and the proof points. Use it to write blog posts, landing pages, launch tweets, sales decks, and conference abstracts.

---

## 1. The one-liner

> **Contentstack Stacksmith turns your CMS schema into code — authored in TypeScript, reviewed in pull requests, and safely promoted across environments.**

## 2. The 30-second pitch

Most teams build their Contentstack content model by clicking around the web UI. That works until it doesn't: changes drift between dev, staging, and prod. There's no review, no diff, no audit trail. Promoting a model from one stack to another is a manual, error-prone slog.

Contentstack Stacksmith fixes that. Define your content types and global fields in plain TypeScript. Commit them to git. Diff them against your live stack. Apply only the safe, additive changes with a single command. Generate types and documentation automatically from the same source of truth.

It's **infrastructure-as-code for your CMS schema.**

## 3. The elevator analogy

> "Terraform, but for your Contentstack content model."

Or for the Prisma-fluent crowd:

> "Prisma-style schema workflow for Contentstack."

## 4. Why it matters

| Before                                | After                                    |
| ------------------------------------- | ---------------------------------------- |
| Click-ops in the dashboard            | Version-controlled TypeScript            |
| "Did someone change prod again?"      | Every change is a PR                     |
| Manual stack-to-stack promotion       | `csdx stacksmith:promote`, one command       |
| Mid-apply "plan doesn't support that" | `stacksmith:audit-org` catches it first      |
| Hand-written types drift from schema  | `stacksmith:typegen` keeps them honest       |
| Lost track of the model               | `stacksmith:docs` generates current Markdown |

## 5. Audience-specific angles

### For developers

- Author models in **TypeScript**, not JSON or clickflows.
- **15 field builders** cover the full Contentstack CMA surface.
- **Generate types** directly from your schema — offline, deterministic.
- Works with your existing stack: `csdx stacksmith:import` bootstraps a DSL project from any live stack.

### For platform & DevOps teams

- **CI-native:** `--ci`, `--yes`, `--json`, `--dry-run`, env-var auth, management tokens.
- **Partial-failure recovery** — resumes from exactly where a failed apply stopped.
- **Safe by default:** destructive changes are blocked without an override. No surprises in prod.
- **Region-aware** — inherits endpoints from the parent `csdx` CLI, so it just works in every Contentstack region.

### For content architects

- **Diff before you apply.** See exactly what will change — added fields, metadata shifts, dependency order.
- **Org audit** tells you if your plan supports what you're about to do — _before_ you hit a mid-apply error.
- **Full CMA fidelity:** taxonomies, modular blocks (inline + global field refs), JSON RTE plugins, enum advanced choices, url patterns, singletons — all round-trip exactly.

### For engineering leadership

- **Model changes flow through the same review process as code.** No second governance system.
- **Compliance-friendly audit trail** — every change is a commit.
- **Lower risk on promotion.** Dry-run, diff, audit, and phase-1 safety rails mean fewer 2 a.m. pages.
- **Faster onboarding.** New engineers read the model in TypeScript instead of clicking through dashboards.

### For marketing / product leaders

- Models are now a **developer-grade product artifact** — not a tribal knowledge asset locked in a UI.
- Teams ship **faster** because model changes don't require a meeting.
- **Fewer production incidents** from unreviewed schema changes.

## 6. Proof points

- **Two public packages:** `@timbenniks/contentstack-stacksmith` (authoring) and `@timbenniks/contentstack-stacksmith-cli` (`csdx` plugin).
- **15 field builders** cover every CMA field type Contentstack supports.
- **10 CLI commands:** `init`, `import`, `build`, `plan`, `diff`, `apply`, `promote`, `typegen`, `docs`, `audit-org`.
- **Four sample apps** demonstrating real-world shapes: minimal starter, editorial blog, page-builder, and e-commerce.
- **Round-trip verified:** `stacksmith:import` → `stacksmith:apply` produces an identical stack.
- **Multi-auth:** management tokens, token aliases, `auth:login` sessions (basic + OAuth), env vars, interactive prompt.
- **Safe apply model:** only low-risk, additive operations go through automatically. Deletes, type changes, and required-field tightening are blocked.

## 7. Feature highlights (names worth repeating)

- **Models-as-code DSL** — TypeScript-first content model authoring.
- **Diff & plan** — deterministic, dependency-aware, human-readable.
- **Safe apply** — phase-1 safety model with partial-failure recovery.
- **Org audit** — plan capability + per-stack capacity cross-reference.
- **Type generation** — from local DSL (offline) or live stack (REST + GraphQL).
- **Docs generation** — Markdown, HTML, JSON.
- **Round-trip import** — start from any existing stack, keep going.

## 8. Taglines & headline variants

- _Models as code. Finally._
- _Your CMS schema, in pull requests where it belongs._
- _Stop clicking. Start committing._
- _Terraform for Contentstack content models._
- _Safe, diff-able, promotable — the content model workflow you've been writing yourself._

## 9. Objection handling

**"We already have sandbox stacks."**
Sandboxes don't solve drift between them. This does — with a single source of truth in git.

**"Our content architects don't write TypeScript."**
They don't have to. Developers author the model; architects review the diff in the PR. The diff is designed to be readable without reading the DSL.

**"What if I need to delete a field?"**
Destructive operations are intentionally blocked in phase 1 — you still do them manually in the UI, with intent. That's a feature, not a limitation.

**"We use the UI and it works fine."**
Great — `csdx stacksmith:import` meets you where you are. Bootstrap a DSL project from your existing stack in one command, then adopt at your own pace.

**"Is this official Contentstack?"**
It's built as a Contentstack CLI (`csdx`) plugin and follows Contentstack conventions end-to-end. It uses the parent CLI's auth, region, and endpoint handling.

## 10. Call-to-action options

- **For developers:** _Run `csdx stacksmith:import` against one of your stacks and see your model compile into TypeScript in under a minute._
- **For platform teams:** _Wire `csdx stacksmith:apply --ci --yes` into a staging pipeline this sprint._
- **For leadership:** _Ask your team how many Contentstack model changes in the last quarter were reviewed in a PR. If the answer is "none," read the PRD._

## 11. Links

- [README](../../README.md)
- [PRD](./prd.md)
- [Tech spec](./tech-spec.md)
- [Full documentation](../documentation.md)
