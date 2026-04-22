# Auth flexibility: OAuth, session tokens, interactive prompts, direct flags

## Context

Today every remote command (`stacksmith:apply`, `stacksmith:promote`, `stacksmith:diff`, `stacksmith:import`, `stacksmith:plan`) requires `--token-alias` pointing at a management token registered via `csdx auth:tokens:add`. This works for users already inside the Contentstack CLI but has real friction:

- First-time users run `csdx stacksmith:init`, write some DSL, then hit a wall: they need to create a management token in the web UI, register it as an alias, and come back.
- OAuth users who did `csdx auth:login --oauth` have a valid access token stored by the parent CLI, but our plugin ignores it.
- Basic-login users who did `csdx auth:login` have a session authtoken stored, but our plugin also ignores it.
- CI pipelines with a secret in an env var have to wrap it in an alias dance or set `CS_AUTHTOKEN`, which isn't documented. And as of today, the `CS_AUTHTOKEN` fallback in [token.ts](../packages/cli/src/utils/token.ts) is likely broken on the wire — we send it as `authorization:` regardless of its actual type.

## Ground truth about parent-CLI auth storage

Verified against `@contentstack/cli-utilities@1.18.1` in this repo's `node_modules`:

| Auth source | `configHandler` keys | HTTP header the CMA expects |
|---|---|---|
| Management token (`csdx auth:tokens:add`) | `tokens.<alias>` (raw string, or `{ token, apiKey, type }` for some types) | `authorization: <token>` |
| Basic login (`csdx auth:login`) | `authtoken`, `email`, `authorisationType: "BASIC"` | `authtoken: <token>` (header name `authtoken`, NOT `authorization`) |
| OAuth login (`csdx auth:login --oauth`) | `oauthAccessToken`, `oauthRefreshToken`, `oauthDateTime`, `authorisationType: "OAUTH"` | `authorization: Bearer <token>` |

Refs: `auth-handler.js:241-252`, `contentstack-management-sdk.js:132-152` inside `@contentstack/cli-utilities`. `getToken` in `@contentstack/cli-command/lib/index.js:75-82` returns whatever's stored under `tokens.<alias>` — a raw string for most aliases, but some stored objects (delivery tokens) come back as `{ token, apiKey }`. The parent CLI handles token refresh for OAuth internally; we only read the current value.

**This changes the plan materially:** our `ManagementClientFactory` currently hard-codes `authorization: <token>`. That's right for management tokens, wrong for basic-session tokens (CMA would 401 because it expects the `authtoken:` header), and wrong for OAuth (missing `Bearer` prefix). The resolver can't just return a string; it has to return a token *type* so the HTTP layer sends the right header.

## Scope decisions (locked)

- **Support all three token types** — management, basic-session, OAuth. Touches the HTTP layer but fixes the latent env-var bug along the way.
- **Drop `required: true` from `--token-alias` everywhere** (today only `stacksmith:promote` has it required at the flag level). Mildly breaking for scripts that relied on oclif's fail-fast, but the resolver emits an equally explicit error when no credentials are resolvable.
- **`--delivery-token` for `stacksmith:typegen --from-stack` is out of scope.** Delivery tokens are a different auth model (stack-scoped, read-only) and the typegen prompt flow is different (needs `environment`, not `branch`). Track as a follow-up.

## Goals

- `csdx auth:login` (basic) users run `csdx stacksmith:apply --stack blt123` with no extra flags and it Just Works.
- `csdx auth:login --oauth` users do the same.
- CI job passes `--management-token $MGMT` without touching `configHandler`.
- User with nothing set up gets a masked-input prompt for a management token (unless `--ci`, in which case fail fast with every supported mechanism listed).
- Alias-based auth keeps working exactly as today.

## Auth sources, in precedence order

1. **Explicit flag**: `--management-token <token>`. Highest — the user asked for it.
2. **Token alias**: `--token-alias <alias>` via `command.getToken(alias)`. Unchanged.
3. **Parent CLI OAuth session**: `configHandler.get("authorisationType") === "OAUTH"` AND `configHandler.get("oauthAccessToken")` is set.
4. **Parent CLI basic session**: `configHandler.get("authorisationType") === "BASIC"` AND `configHandler.get("authtoken")` is set.
5. **Environment variable**: `CS_AUTHTOKEN` / `CONTENTSTACK_MANAGEMENT_TOKEN`. Treated as a management token (`authorization:` header).
6. **Interactive prompt** (only when stdout is a TTY AND `--ci` is NOT set): masked input for a management token. Never persisted.

## ResolvedToken shape

Replace [`ResolvedManagementToken`](../packages/cli/src/utils/token.ts) with:

```ts
export type TokenKind = "management" | "session" | "oauth";
export type TokenSource = "flag" | "token-alias" | "cli-session" | "cli-oauth" | "environment" | "prompt" | "missing";

export interface ResolvedToken {
  token: string;
  kind: TokenKind;
  source: TokenSource;
}
```

`kind` determines the HTTP header; `source` is telemetry-only and surfaces in `formatRemoteRuntimeContext`.

## ManagementClientFactory changes

[`ManagementClientFactory.create`](../packages/cli/src/integrations/contentstack/management-client-factory.ts) today builds headers unconditionally as `authorization: <managementToken>`. Change `ManagementClientOptions` to accept a `ResolvedToken` instead of a raw string, and build headers per `kind`:

```ts
const authHeaders = (() => {
  switch (options.token.kind) {
    case "management": return { authorization: options.token.token };
    case "session":    return { authtoken: options.token.token };
    case "oauth":      return { authorization: `Bearer ${options.token.token}` };
  }
})();

const headers = {
  "Content-Type": "application/json",
  api_key: options.stackApiKey,
  ...authHeaders,
  ...(options.branch ? { branch: options.branch } : {}),
  ...(init.apiVersion ? { api_version: init.apiVersion } : {}),
  ...(init.headers ?? {}),
};
```

Keep the 401/403/5xx/retry logic unchanged. The 401 error message can be improved to say "Your <session|management|OAuth> token may be expired or invalid" using `options.token.source`.

Callers ([apply.ts](../packages/cli/src/commands/models/apply.ts), [promote.ts](../packages/cli/src/commands/models/promote.ts), [diff.ts](../packages/cli/src/commands/models/diff.ts), [import.ts](../packages/cli/src/commands/models/import.ts), [plan.ts](../packages/cli/src/commands/models/plan.ts), [remote-snapshot-service.ts](../packages/cli/src/services/remote-snapshot-service.ts)) pass `ResolvedToken` instead of a string.

## The resolver

Rewrite `resolveManagementTokenContext` in [token.ts](../packages/cli/src/utils/token.ts) with a strategy that:

1. Takes `{ flagToken, tokenAlias, ci, prompt }`.
2. Walks the precedence list above.
3. Returns `ResolvedToken` (including `kind` and `source`).
4. Never logs the token itself.

Do NOT inline the prompt step into the resolver — prompts belong in [`PromptService`](../packages/cli/src/prompts/prompt-service.ts). The resolver returns `{ token: "", source: "missing", kind: "management" }` when nothing resolved; the command decides whether to prompt (TTY + not-CI) or fail.

## Prompt for a management token

Extend [`PromptService`](../packages/cli/src/prompts/prompt-service.ts) with a `promptForToken(message)` method that uses `node:readline` with stdout masking. The existing service is 24 lines of readline — keep it dependency-free rather than pulling in `@inquirer/prompts`. Masking pattern:

```ts
// On 'keypress' events, write "*" to stdout instead of the typed char, and
// collect the real chars in a buffer. Close and return on 'return'.
```

Reject `--ci` + no resolvable token before we ever reach this. Never persist the prompted token; it lives in memory for the life of the command.

## Behavior when `--ci` is set and no token is resolved

Fail fast with an actionable error:

```
No Contentstack credentials found. For CI, pass one of:
  --management-token <token>
  --token-alias <alias>                 (run: csdx auth:tokens:add)
  CS_AUTHTOKEN=<token>                  (environment variable)
  CONTENTSTACK_MANAGEMENT_TOKEN=<token> (environment variable)

For interactive use, run one of:
  csdx auth:login
  csdx auth:login --oauth
```

## Flag surface changes

In [common-flags.ts](../packages/cli/src/utils/common-flags.ts), add to `remoteFlags`:

```ts
"management-token": flags.string({
  description: "Management token. Overrides --token-alias and any parent CLI session.",
}),
```

In [promote.ts](../packages/cli/src/commands/models/promote.ts): change `"token-alias"` from `required: true` to `required: false`. Same for `"source-token-alias"` (though that one is already optional — just add `"source-management-token"` flag for symmetry when `--source-stack` is used).

## Telemetry / logging

`formatRemoteRuntimeContext` in [output-formatter-service.ts](../packages/cli/src/formatters/output-formatter-service.ts) already shows `Token Source: <source>`. Extend the string map to render:

| source | line |
|---|---|
| `flag` | `Token Source: --management-token flag` |
| `token-alias` | `Token Source: alias <alias>` |
| `cli-session` | `Token Source: csdx auth:login session` |
| `cli-oauth` | `Token Source: csdx auth:login --oauth session` |
| `environment` | `Token Source: environment (CS_AUTHTOKEN)` |
| `prompt` | `Token Source: interactive prompt` |

Never print the token itself.

## Scope decisions and non-goals

- **Not implementing our own OAuth flow.** Rely on `csdx auth:login --oauth`.
- **Not handling OAuth token refresh.** Parent CLI refreshes; we read current value per invocation. If the parent's refresh fails, we surface the 401 verbatim.
- **Not persisting prompted tokens.** Prompts are ephemeral; `csdx auth:tokens:add` is the persistence path.
- **Not adding `--api-key` as an alias for `--stack`.** Churn with no user win.
- **Not touching the delivery-token flow in `stacksmith:typegen --from-stack`.** Separate follow-up.

## Testing

Add a new [test/utils/token.test.ts](../packages/cli/test/utils/token.test.ts) for the resolver with these cases (mocking `command.getToken` and `configHandler.get`):

1. `--management-token xyz` → `{ token: "xyz", kind: "management", source: "flag" }`; `getToken` not called.
2. `--token-alias my-alias` returning a string → `kind: "management"`, `source: "token-alias"`.
3. `--token-alias my-alias` returning `{ token, apiKey }` → same; falls back to `.token`.
4. No flags, `authorisationType === "OAUTH"` + `oauthAccessToken` set → `kind: "oauth"`, `source: "cli-oauth"`.
5. No flags, `authorisationType === "BASIC"` + `authtoken` set → `kind: "session"`, `source: "cli-session"`.
6. No flags, no session, `CS_AUTHTOKEN` set → `kind: "management"`, `source: "environment"`.
7. No flags, nothing set → `source: "missing"` (command layer decides prompt vs error).

Add command-level integration tests to [apply.test.ts](../packages/cli/test/commands/apply.test.ts) and [promote.test.ts](../packages/cli/test/commands/promote.test.ts):

8. No `--token-alias`, but mock `configHandler.get` so a basic session is present → apply works; inspect the fetch call and assert `authtoken:` header is set and `authorization:` is absent.
9. Mock OAuth session → assert `authorization: Bearer <token>` header.
10. `--ci` + nothing resolved → exits 1 with the multi-line error message above.

Prompt tests: stub `PromptService.promptForToken` to return a canned value; assert it's only called when TTY + not `--ci`.

## Implementation order

1. **Types + resolver** ([token.ts](../packages/cli/src/utils/token.ts)) — `ResolvedToken`, new resolver. No consumers yet. Unit tests land.
2. **HTTP layer** ([management-client-factory.ts](../packages/cli/src/integrations/contentstack/management-client-factory.ts)) — accept `ResolvedToken`, branch on `kind`. Existing callers still pass management-kind, so no behavior change.
3. **Prompt helper** ([prompt-service.ts](../packages/cli/src/prompts/prompt-service.ts)) — masked input.
4. **Parent-CLI context** ([parent-cli-context.ts](../packages/cli/src/utils/parent-cli-context.ts)) — plumb `flagToken`, `ci`, `prompt` into options bag; return `ResolvedToken`.
5. **Commands** — add `--management-token` to `remoteFlags`; drop `required: true` on `promote.ts`; pass the resolved token to services. One command at a time so tests stay green.
6. **Formatter** — extend `Token Source` labels.
7. **README** — rewrite auth section with precedence and CI examples.

## Files to touch

**Modified:**

- [packages/cli/src/utils/token.ts](../packages/cli/src/utils/token.ts) — rewrite.
- [packages/cli/src/utils/parent-cli-context.ts](../packages/cli/src/utils/parent-cli-context.ts) — extend options.
- [packages/cli/src/utils/common-flags.ts](../packages/cli/src/utils/common-flags.ts) — add `--management-token`.
- [packages/cli/src/integrations/contentstack/management-client-factory.ts](../packages/cli/src/integrations/contentstack/management-client-factory.ts) — header branching.
- [packages/cli/src/prompts/prompt-service.ts](../packages/cli/src/prompts/prompt-service.ts) — add `promptForToken`.
- [packages/cli/src/commands/models/apply.ts](../packages/cli/src/commands/models/apply.ts), [promote.ts](../packages/cli/src/commands/models/promote.ts), [diff.ts](../packages/cli/src/commands/models/diff.ts), [plan.ts](../packages/cli/src/commands/models/plan.ts), [import.ts](../packages/cli/src/commands/models/import.ts) — flag wiring; drop `required: true` on promote.
- [packages/cli/src/services/remote-snapshot-service.ts](../packages/cli/src/services/remote-snapshot-service.ts), [apply-service.ts](../packages/cli/src/services/apply-service.ts) — pass `ResolvedToken` through.
- [packages/cli/src/formatters/output-formatter-service.ts](../packages/cli/src/formatters/output-formatter-service.ts) — Token Source labels.
- [README.md](../README.md) — auth section rewrite.

**New:**

- [packages/cli/test/utils/token.test.ts](../packages/cli/test/utils/token.test.ts) — resolver unit tests.

## Verification

```sh
pnpm run typecheck   # all 10 tasks green
pnpm run lint        # all green
pnpm run test        # all 159+ tests green, plus new resolver + prompt + integration tests
```

Manual:

- `csdx stacksmith:apply --stack blt123` with only `csdx auth:login` done → apply runs, formatter shows `Token Source: csdx auth:login session`, wire inspection shows `authtoken:` header.
- Same after `csdx auth:login --oauth` → formatter shows oauth; wire shows `authorization: Bearer`.
- `CS_AUTHTOKEN=foo csdx stacksmith:apply --stack blt123 --ci` → resolves from env.
- `csdx stacksmith:apply --stack blt123 --ci` with nothing configured → exits 1 with the multi-line error.
- `csdx stacksmith:apply --stack blt123` in a TTY with nothing configured → masked prompt; Ctrl-C cancels cleanly.
