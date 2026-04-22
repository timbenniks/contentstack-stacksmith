import type { ResolvedToken, TokenKind } from "../../utils/token.js";

export interface ManagementClient {
  request<T>(path: string, init?: RequestInit & { apiVersion?: string }): Promise<T>;
}

export interface ManagementClientOptions {
  stackApiKey: string;
  /**
   * Either a resolved token with its kind, or a raw management-token string (treated as kind: "management").
   * The raw-string form is kept for backwards compatibility with callers that have a token from a non-user source.
   */
  managementToken: string | ResolvedToken;
  cmaBaseUrl: string;
  branch?: string | undefined;
}

const toResolvedToken = (value: string | ResolvedToken): ResolvedToken =>
  typeof value === "string" ? { token: value, kind: "management", source: "flag" } : value;

const buildAuthHeaders = (kind: TokenKind, token: string): Record<string, string> => {
  switch (kind) {
    // Contentstack uses different auth headers depending on how the token was
    // obtained; keep that branching centralized so callers can stay token-source agnostic.
    case "management":
      return { authorization: token };
    case "session":
      return { authtoken: token };
    case "oauth":
      return { authorization: `Bearer ${token}` };
  }
};

const sourceLabel = (source: ResolvedToken["source"]): string => {
  switch (source) {
    case "flag":
      return "management token";
    case "token-alias":
      return "management token alias";
    case "cli-session":
      return "csdx auth:login session";
    case "cli-oauth":
      return "csdx auth:login --oauth session";
    case "environment":
      return "environment-provided token";
    case "prompt":
      return "prompted token";
    default:
      return "token";
  }
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

const isRetryable = (status: number): boolean => status === 429 || status >= 500;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (response: Response, attempt: number): number => {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return BASE_DELAY_MS * Math.pow(2, attempt);
};

export class ManagementClientFactory {
  create(options: ManagementClientOptions): ManagementClient {
    const resolved = toResolvedToken(options.managementToken);
    const authHeaders = buildAuthHeaders(resolved.kind, resolved.token);

    return {
      request: async <T>(path: string, init: RequestInit & { apiVersion?: string } = {}): Promise<T> => {
        const url = new URL(path, options.cmaBaseUrl);
        const headers = {
          "Content-Type": "application/json",
          api_key: options.stackApiKey,
          ...authHeaders,
          ...(options.branch ? { branch: options.branch } : {}),
          ...(init.apiVersion ? { api_version: init.apiVersion } : {}),
          ...(init.headers ?? {}),
        };

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await fetch(url, {
              ...init,
              headers,
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (response.ok) {
              try {
                return (await response.json()) as T;
              } catch (parseError) {
                throw new Error(
                  `Contentstack returned HTTP ${response.status} for ${url.pathname} but the response body was not valid JSON. This usually indicates a truncated response or an upstream proxy injecting HTML.`,
                  { cause: parseError },
                );
              }
            }

            if (isRetryable(response.status) && attempt < MAX_RETRIES) {
              // Respect server-provided backoff when available; otherwise use a
              // simple exponential delay to avoid hammering transient failures.
              const retryMs = getRetryDelay(response, attempt);
              console.warn(
                `Contentstack request ${url.pathname} returned ${response.status}, retrying in ${retryMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
              );
              await wait(retryMs);
              continue;
            }

            if (response.status === 401) {
              throw new Error(
                `Authentication failed (401) for ${url.pathname}. Your ${sourceLabel(resolved.source)} may be expired or invalid.`,
              );
            }

            if (response.status === 403) {
              throw new Error(
                `Authorization denied for ${url.pathname}. Your ${sourceLabel(resolved.source)} may lack the required permissions for this stack.`,
              );
            }

            const body = await response.text();
            // Cap body so a multi-MB HTML error page or a response echoing secrets doesn't
            // end up in logs, stack traces, or support tickets.
            const truncated = body.length > 512 ? `${body.slice(0, 512)}…[truncated ${body.length - 512} chars]` : body;
            throw new Error(`Contentstack API error ${response.status} for ${init.method ?? "GET"} ${url.pathname}: ${truncated}`);
          } catch (error) {
            if (error instanceof Error && error.name === "TimeoutError") {
              lastError = new Error(`Contentstack request timed out for ${url.pathname} after ${REQUEST_TIMEOUT_MS}ms`);
              if (attempt < MAX_RETRIES) {
                console.warn(`Request timed out, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
                continue;
              }
              throw lastError;
            }
            throw error;
          }
        }

        throw lastError ?? new Error(`Contentstack request failed for ${url.pathname} after ${MAX_RETRIES} retries`);
      },
    };
  }
}
