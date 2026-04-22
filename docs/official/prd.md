# Contentstack Stacksmith — Product Requirements Document

**Status:** Active
**Owner:** Tim Benniks
**Last updated:** 2026-04-22

---

## 1. Summary

Contentstack Stacksmith is a TypeScript-first toolkit that lets teams define, version-control, diff, and safely apply Contentstack content models as code. It replaces click-ops in the Contentstack dashboard with an infrastructure-as-code workflow modeled after Terraform and Prisma.

It ships as two public artifacts:

- `@timbenniks/contentstack-stacksmith` — authoring library (DSL + programmatic APIs).
- `@timbenniks/contentstack-stacksmith-cli` — a `csdx` plugin exposing `csdx stacksmith:*` commands.

## 2. Problem

Today, Contentstack content models are authored and mutated primarily through the web UI. This creates real pain:

- **No single source of truth.** Models drift between environments (dev / staging / prod). Changes made in prod aren't visible in git.
- **No review gate.** A content architect can change a field's type or delete a content type with no PR, no diff, no approval.
- **Unsafe promotion.** Moving models between stacks is manual, error-prone, and frequently partial.
- **No offline authoring.** You cannot design models without an active stack.
- **No type safety for developers.** Frontend teams hand-write TypeScript types that drift from the live schema.
- **Org-level surprises.** Teams discover mid-apply that a plan doesn't support taxonomy, or that a stack has hit its content-type limit.

## 3. Goals

- Make content models a **first-class code artifact**: authored in TypeScript, reviewed in PRs, promoted via CI.
- Provide a **safe-by-default apply pipeline** that refuses destructive operations unless explicitly opted into.
- Keep a **deterministic, normalized schema** so diffs are meaningful and reviewable.
- Support **round-tripping**: `stacksmith:import` from a live stack → DSL → `stacksmith:apply` must produce an identical stack.
- Surface **org-level capability and capacity** issues _before_ the apply hits CMA errors.
- Generate **TypeScript types** and **human-readable docs** from the same source of truth.

## 4. Non-goals

- We do not aim to replace the Contentstack web UI for content editors or marketers authoring entries.
- We do not manage entries, assets, environments, or publishing — only the _shape_ of the CMS.
- We do not sandbox untrusted DSL code. Model files are executable TypeScript; treat them like backend source.
- Destructive schema changes (deletes, field-type changes, narrowing validations) are intentionally out of scope for phase 1's automated apply.

## 5. Target users

| Persona                          | What they need                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Content architect / engineer** | Author models in TypeScript, diff before applying, promote across stacks.                                     |
| **Frontend developer**           | Generate accurate TS types from the real schema; stay in sync without handwriting types.                      |
| **Platform / DevOps**            | Run apply/promote in CI with token-based auth, resume after partial failures, get JSON output for automation. |
| **Technical leadership**         | See models reviewed in PRs like any other code. Catch plan-limit blockers before they surface in production.  |

## 6. Core user journeys

1. **Onboard an existing stack.** `csdx stacksmith:import` pulls content types + global fields into DSL files. The resulting tree is committed to git.
2. **Evolve the model.** Developer edits TS → runs `stacksmith:build` + `stacksmith:diff` locally → opens PR with the diff as part of review → merges.
3. **Promote to an environment.** CI runs `csdx stacksmith:apply --ci --yes` against the target stack using a management token. Only low-risk additive changes go through; blockers abort the job.
4. **Audit before apply.** `csdx stacksmith:audit-org` cross-references the DSL against the org's plan capabilities and per-stack usage — flags missing features and capacity overruns up front.
5. **Generate types and docs.** `csdx stacksmith:typegen` produces TS definitions; `csdx stacksmith:docs` produces Markdown / HTML / JSON for humans.

## 7. Key capabilities (shipped)

- **DSL:** 15 field builders covering the full CMA surface — text, number, boolean, date, json, file, link, markdown, richText, jsonRte, reference, group, enumField, modularBlocks, globalField, taxonomy.
- **Full CMA field fidelity:** round-trips `required`, `unique`, `multiple`, `non_localizable`, format/error_messages, date ranges, enum advanced choices, file extensions, reference_to, JSON RTE plugins, taxonomy per-term constraints, modular blocks (inline + global-field-ref), content type options (publishable, is_page, singleton, url_pattern, url_prefix).
- **Deterministic compilation** with stable IDs and dependency metadata.
- **Dependency-aware planning** that orders references and global fields correctly.
- **Safe apply** — creates, additive field adds, low-risk metadata updates only. Blocks deletes, type changes, required tightening, reference narrowing.
- **Partial-failure recovery** via `.contentstack/models/apply-state.json` with schema-hash invalidation.
- **Flexible auth** — management tokens, token aliases, `auth:login` sessions (basic + OAuth), env vars, interactive prompt. CI-safe.
- **Org audit** — plan capability + numeric limit checks, with optional CMS usage cross-reference.
- **Promote** — local→remote or stack→stack, same safety model as apply.
- **Type generation** — from local DSL (offline) or from a live stack (REST or GraphQL).
- **Docs generation** — Markdown, JSON, or HTML.

## 8. Success metrics

- Time to promote a model change across three environments — target: < 5 minutes end-to-end in CI.
- Percentage of model changes that flow through PR review rather than the web UI.
- Number of apply failures caught _before_ mutation (audit + dry-run + diff) vs. mid-apply.
- Parity test: `import → apply` round-trip produces zero drift across all sample apps.
- Adoption — number of internal stacks managed via `stacksmith:*`.

## 9. Constraints & risks

- **DSL files are executable code.** Malicious or buggy model files can exfiltrate tokens or run I/O before validation. Mitigation: documented threat model, same scrutiny as backend code.
- **Phase 1 is conservative.** Teams that need destructive changes still fall back to the UI or manual CMA calls. Mitigation: clearly scoped safety model; destructive ops are a roadmap item.
- **Plan response shape changes.** Contentstack's `include_plan=true` response may evolve. Mitigation: fail-soft `UNRECOGNIZED_PLAN_SHAPE` advisory + fixture refresh script.

## 10. Roadmap (directional)

- Expanded risk ladder (opt-in mid-risk apply with explicit flags).
- Deeper GraphQL typegen parity with REST.
- More sample apps covering localization and complex modular composition.
- Richer org audit (webhook limits, extension usage, branch topology).

## 11. References

- [Architecture](../architecture.md)
- [CLI Workflow](../cli-workflow.md)
- [Internal Schema](../internal-schema.md)
- [CMA Field Reference](../cma-field-reference.md)
- [Org Audit Command](../org-audit-command.md)
- [Auth Flexibility](../auth-flexibility.md)
