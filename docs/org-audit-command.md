# `stacksmith:audit-org` — capability audit against an organization's plan

## Context

Plans apply successfully right up until they hit a plan-level limit the user didn't know existed. Typical failure modes we've seen or can predict:

- User's org plan doesn't include branches, but the local DSL or CI pipeline sets `--branch dev`. Apply fails mid-execution with a non-obvious "branch feature not enabled" error.
- Taxonomy is a paid feature on some plans; a DSL with `taxonomy()` fields compiles locally but applies fail.
- Content-type-per-stack or field-per-content-type ceilings get hit deep into an import; the user sees a cryptic 422 from the CMA.
- JSON RTE, modular blocks, extensions, marketplace apps, and webhooks all have plan-gated availability.

There is no upfront check. Users learn what their plan supports by failing.

Contentstack exposes all of this via `GET /v3/organizations/{organizationUid}?include_plan=true`. The response includes the subscribed plan, feature flags (`is_branch_enabled`, `is_taxonomy_enabled`, etc.), and numeric limits (max content types, max fields, etc.). This is enough to do a "would this plan let me apply this DSL?" check offline.

## Goals

A new `csdx stacksmith:audit-org` command that:

1. Hits `/v3/organizations/{orgUid}?include_plan=true` once.
2. Optionally compiles the local DSL ([`compileModelRegistry`](../packages/dsl/src/compile/compile.ts)) and cross-references it against the plan's features and numeric limits.
3. Prints a structured report: PASS / WARN / BLOCK per checked capability, with remediation hints.
4. Supports `--json` for CI; non-zero exit code when any BLOCK findings exist.

The command is read-only and safe to run against production orgs.

## Command design

```
csdx stacksmith:audit-org --org <uid> [--token-alias <alias>] [--cwd .] [--config …] [--json]
```

Flags:

- `--org <uid>` (required). The organization UID. Contentstack stores this per-stack; we can also attempt to derive it by calling `/v3/stacks/{api_key}` if the user passes `--stack` — fall back to requiring `--org` if derivation fails.
- `--token-alias` / `--management-token` — standard auth chain. Requires read permission on the organization.
- `--cwd`, `--config`, `--out-dir` — the usual build flags. When present, cross-reference the local DSL against the org plan. When absent, emit a capabilities-only report (useful on fresh machines before any DSL exists).
- `--json` — machine-readable output for CI. When any finding has level `blocker`, exit 1.
- `--ci` — non-interactive behavior; inherited.

Examples:

```bash
# Capabilities-only: what does my org support?
csdx stacksmith:audit-org --org blt-org-uid --token-alias my-alias

# Full audit: does my local DSL fit my plan?
csdx stacksmith:audit-org --org blt-org-uid --token-alias my-alias --cwd apps/simple-blog
```

## Output shape

Follow the existing `PlanRisk` / `ValidationFinding` shape so the formatter can reuse [OutputFormatterService.formatBuild](../packages/cli/src/formatters/output-formatter-service.ts) semantics (`[BLOCKER]`, `[HIGH]`, `[MEDIUM]`, `[LOW]` prefixes).

```ts
export interface OrgAuditFinding {
  level: "blocker" | "high" | "medium" | "low";
  code: string;               // e.g. "BRANCHES_NOT_AVAILABLE", "MAX_CONTENT_TYPES_EXCEEDED"
  message: string;
  capability: string;         // "branches", "taxonomy", "max_content_types", ...
  planValue?: unknown;        // whatever the org plan says (true/false, 25, ...)
  localValue?: unknown;       // what the local DSL needs
  remediation?: string;       // e.g. "Remove taxonomy() fields from content-types/article.ts"
}

export interface OrgAuditReport {
  organizationUid: string;
  organizationName: string;
  plan: {
    name: string;
    tier?: string;
  };
  features: Record<string, boolean>;     // raw feature map from plan
  limits: Record<string, number>;        // raw limits
  findings: OrgAuditFinding[];
  summary: { total: number; blockers: number; warnings: number; passes: number };
}
```

## Checks to implement

Grouped by what the audit inspects. Each check gets a stable `code` so we can cross-link to a troubleshooting doc later.

### Feature flags (boolean plan features)

| Check | Feature key | Local trigger | Level when missing |
|---|---|---|---|
| Branches | `is_branch_enabled` | any command ever used `--branch`, OR `modelsConfig.branch` is set | `blocker` if DSL depends on a branch, otherwise `medium` |
| Taxonomy | `is_taxonomy_enabled` | DSL contains `kind === "taxonomy"` field | `blocker` |
| Global fields | `is_global_field_enabled` | DSL contains any `defineGlobalField` | `blocker` |
| JSON RTE | `is_json_rte_enabled` | DSL contains `kind === "json_rte"` field | `blocker` |
| Modular blocks | `is_modular_blocks_enabled` | DSL contains `kind === "modular_blocks"` field | `blocker` |
| Webhooks | `is_webhook_enabled` | N/A for now | informational `low` |
| Extensions / Marketplace apps | `is_extension_enabled` | DSL contains `extensions: [...]` on any field | `high` (soft-fail: extensions may still work per-stack) |

The exact feature-flag names on the `plan` object need to be confirmed against a real response. Store them in a constant map so adding a new check is a one-liner.

### Numeric limits

Compare local schema against `plan.limits.*`:

| Check | Limit key | Local measurement |
|---|---|---|
| Max content types | `max_content_types` | `schema.entities.filter(e => e.kind === "content_type").length` |
| Max global fields | `max_global_fields` | `schema.entities.filter(e => e.kind === "global_field").length` |
| Max fields per content type | `max_fields_per_content_type` | `max(entity.fields.length for each content_type)` |
| Max nesting depth (groups) | `max_group_depth` | compute via tree walk |
| Max modular block types | `max_modular_block_types` | `max(field.blocks.length for modular_blocks fields)` |

Level for limit violations: `blocker` when `localValue > planValue`. Skip the check if the plan doesn't report the limit (unknown plans shouldn't false-positive).

### Stack-level sanity checks (optional, requires `--stack`)

If `--stack` is provided, additionally call `GET /v3/stacks/{api_key}` and check:

- Stack belongs to the org UID the user passed (catch "wrong org" accidents).
- Stack's branch count vs. plan's `max_branches`.

Skip entirely when `--stack` is omitted.

## Implementation structure

New files:

- `packages/cli/src/services/org-audit-service.ts` — `OrgAuditService.audit({ orgUid, localSchema?, stackApiKey? })` that does the single GET, runs the rule pipeline, and returns `OrgAuditReport`.
- `packages/cli/src/integrations/contentstack/organization-repository.ts` — thin wrapper around `GET /v3/organizations/{uid}?include_plan=true`. Uses the existing `ManagementClient`.
- `packages/cli/src/services/org-audit-rules.ts` — pure functions: `checkBranches`, `checkTaxonomy`, … each taking `(planResponse, localSchema?)` and returning `OrgAuditFinding | undefined`. Easy to unit-test.
- `packages/cli/src/commands/models/audit-org.ts` — oclif command. Parses flags, calls service, formats output.

Formatter extension:

- Add `OutputFormatterService.formatOrgAudit(report)` producing human-readable output grouped by severity, mirroring the `formatBuild` style.

## Error handling

- 401/403 from the org endpoint → "Your token lacks `read` on organization {orgUid}. Use a token from an owner/admin or ask to be added to the org."
- 404 → "Organization {orgUid} not found. Double-check the UID — it's not the stack API key; find it in the URL bar of the org's page in the Contentstack UI."
- The endpoint may change shape across Contentstack releases. Validate with a narrow Zod schema (or hand-rolled guard) and emit a single "unrecognized plan shape; audit rules may be stale" warning if the response misses expected keys, rather than crashing.

## Non-goals (v1)

- **Not auto-fixing anything.** This is purely diagnostic; no DSL edits, no stack mutations.
- **Not caching the plan response to disk.** The command is fast and plans change rarely; caching adds staleness risk for no real win.
- **Not auditing webhooks, workflows, or marketplace apps in depth.** Those are stack-level concerns and belong in a separate `stacksmith:audit-stack` command if the need appears.
- **Not polling over time.** If users want scheduled reports, they wire `csdx stacksmith:audit-org --json` into their own CI cron.

## Testing

- `org-audit-rules.test.ts` — unit tests per rule, with hand-crafted plan fixtures and local schema fixtures. Each rule gets a "pass" and "fail" case plus "unknown plan key" case.
- `audit-org.test.ts` — oclif integration, mocking `fetch` to return a canned org response. Assert:
  - No local schema → capabilities-only report.
  - Local schema with taxonomy field + plan with `is_taxonomy_enabled: false` → exit 1, finding with code `TAXONOMY_NOT_AVAILABLE`.
  - `--json` → parseable JSON; no ANSI.
- A fixture file `test/fixtures/org-response.json` with a realistic shape (scrubbed of any real IDs). Worth capturing now so we can spot shape changes against the live API later.

## Files to touch

New:

- [packages/cli/src/commands/models/audit-org.ts](../packages/cli/src/commands/models/audit-org.ts)
- [packages/cli/src/services/org-audit-service.ts](../packages/cli/src/services/org-audit-service.ts)
- [packages/cli/src/services/org-audit-rules.ts](../packages/cli/src/services/org-audit-rules.ts)
- [packages/cli/src/integrations/contentstack/organization-repository.ts](../packages/cli/src/integrations/contentstack/organization-repository.ts)
- [packages/cli/test/commands/audit-org.test.ts](../packages/cli/test/commands/audit-org.test.ts)
- [packages/cli/test/services/org-audit-rules.test.ts](../packages/cli/test/services/org-audit-rules.test.ts)
- [packages/cli/test/fixtures/org-response.json](../packages/cli/test/fixtures/org-response.json)

Modified:

- [packages/cli/src/formatters/output-formatter-service.ts](../packages/cli/src/formatters/output-formatter-service.ts) — add `formatOrgAudit`.
- [README.md](../README.md) — document the command and link this design doc.

## Open questions

- **Exact feature-flag keys on the plan object.** Today's description is based on Contentstack's public docs and field names we've seen elsewhere. The first implementation step is to hit `/v3/organizations/{uid}?include_plan=true` against a real org and snapshot the response into `test/fixtures/org-response.json`. Keys may need adjusting.
- **Do we audit branches that exist in the stack but aren't declared locally?** Out of scope for v1 — stay organization-level.
- **Should `stacksmith:apply` and `stacksmith:promote` run the audit automatically as a preflight?** Useful, but adds a mandatory network call to every apply. Defer until we have real data on how often audit findings actually catch apply failures. If we do add it later, gate it on `--audit` (opt-in) or `--no-audit` (default on).

---

## Implementation notes (post-ship)

> **The section above is the original design rationale.** Some guesses from the design phase did not match reality (see below). The sections that follow describe the shipped behavior and supersede any earlier guesses.

### Source of truth

- **User-facing reference:** [apps/docs/reference/cli.md](../apps/docs/reference/cli.md#csdx-models-audit-org). That page is the source of truth for flags, exit codes, and output shape.
- **Rule pipeline:** [packages/cli/src/services/org-audit-rules.ts](../packages/cli/src/services/org-audit-rules.ts). `PLAN_KEYS` maps capability names → the `uid` strings Contentstack actually uses on `organization.plan.features[]`.
- **Usage pipeline:** [packages/cli/src/services/org-usage-rules.ts](../packages/cli/src/services/org-usage-rules.ts) + [packages/cli/src/integrations/contentstack/analytics-repository.ts](../packages/cli/src/integrations/contentstack/analytics-repository.ts).
- **Fixtures:**
  - [packages/cli/test/fixtures/org-response.json](../packages/cli/test/fixtures/org-response.json) — captured via `pnpm run capture-org-fixture <orgUid>`.
  - [packages/cli/test/fixtures/analytics-response.json](../packages/cli/test/fixtures/analytics-response.json) — captured via `pnpm run capture-analytics-fixture <orgUid> [appBaseUrl]`.

### Plan response shape (ground truth)

The real response does **not** use flat `is_*_enabled` booleans + `max_*` numbers. Instead, `organization.plan.features[]` is an array of per-capability objects:

```json
{
  "uid": "content_types",
  "name": "Content Types",
  "enabled": true,
  "limit": 1000,
  "max_limit": 1000
}
```

Feature uids observed in real responses (not exhaustive; always refresh the fixture):

| uid | Meaning |
| --- | --- |
| `content_types` | Total content types per stack |
| `global_fields` | Total global fields per stack |
| `maxFieldsLimit` | Max fields per content type |
| `maxContentTypesPerReferenceField` | Max targets in a reference field's `to[]` |
| `maxDynamicBlocksPerContentType` | Max `modular_blocks` fields on a single CT |
| `maxDynamicBlockObjects` | Max blocks inside a single `modular_blocks` field |
| `maxDynamicBlocksNestingDepth` | How deeply modular blocks can nest |
| `max_taxonomies_per_content_type` | Max taxonomy fields per CT |
| `maxContentTypesPerJsonRte` | Max referenced types in a JSON RTE field |
| `maxContentTypesPerRichTextField` | Max referenced types in a rich text field |
| `taxonomy` | Taxonomy feature availability + count limit |
| `branches` | Branch feature availability + count limit |

If Contentstack changes a uid, update `PLAN_KEYS` in one place and refresh the fixture.

### Usage cross-reference (`--include-usage`)

Added after the initial ship. Uses the undocumented `/analytics/v1/dashboard/data/processor/<name>` endpoints the Contentstack web UI calls to render the CMS dashboard. Each processor maps to a `chartType` (`status-view-trend` for single-count widgets, `stack` for the per-stack table).

- `analytics-repository.ts` fetches all 14 processors in parallel against `uiHost` (e.g. `https://eu-app.contentstack.com`) using the user's session or OAuth token. **Never** the management token — it's stack-scoped and not authorized here.
- `org-usage-rules.ts` turns the snapshot into findings:
  - Org-level: headroom per metric (`ORG_USAGE_OK_*`, `ORG_USAGE_HIGH_*`, `ORG_USAGE_NEAR_LIMIT_*`, `ORG_USAGE_AT_LIMIT_*`).
  - Stack-level (when `--stack` is also passed): projects the local DSL's additions against the targeted stack's current content-type / global-field count (`STACK_CAPACITY_OK_*`, `STACK_CAPACITY_TIGHT_*`, `STACK_CAPACITY_EXCEEDED_*`, `STACK_AT_CAPACITY_*`).
- **Graceful degradation:** if every analytics processor returns 401 / 403 / 404, the whole snapshot is classified as "disabled" and a single `ANALYTICS_DISABLED` informational finding is emitted — no per-processor noise. Partial outages (mixed success + 5xx failure) get up to 5 `ANALYTICS_PROCESSOR_UNAVAILABLE` notes and the remaining data still populates. Either way, the plan-capabilities audit runs to completion.

### Exporting reports (`--output` / `--output-format`)

`formatOrgAuditMarkdown()` in [output-formatter-service.ts](../packages/cli/src/formatters/output-formatter-service.ts) renders a support-ticket-friendly Markdown document with the org identity, plan, findings grouped by severity (with remediation notes), a plan-features table, and (when `--include-usage` is on) usage + per-stack usage tables. JSON output uses `formatJson()` — the same structure you get on stdout via `--json`, just persisted.

Format resolution: extension inference (`.json` / `.md`) unless `--output-format` is passed explicitly.

### Auth-scope enforcement

`resolveUserAuthToken` in [packages/cli/src/utils/token.ts](../packages/cli/src/utils/token.ts) accepts only `kind: "session"` or `"oauth"`. The command rejects `--management-token`, `--token-alias`, and `CS_AUTHTOKEN` env vars up-front before any network call — prevents users from discovering "management tokens don't work on org or analytics endpoints" the hard way. Hidden flags carry the management-token flag shape so the redirect message is helpful rather than oclif's generic "Nonexistent flag".
