import { Command as ContentstackCommand } from "@contentstack/cli-command";

type RuntimePrototype = {
  getToken?: unknown;
  region?: unknown;
  cmaHost?: unknown;
  cdaHost?: unknown;
  cmaAPIUrl?: unknown;
  cdaAPIUrl?: unknown;
  uiHost?: unknown;
};

export const runtimePrototype = ContentstackCommand.prototype as unknown as RuntimePrototype;

export const runtimeDescriptors = {
  getToken: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "getToken"),
  region: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "region"),
  cmaHost: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "cmaHost"),
  cdaHost: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "cdaHost"),
  cmaAPIUrl: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "cmaAPIUrl"),
  cdaAPIUrl: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "cdaAPIUrl"),
  uiHost: Object.getOwnPropertyDescriptor(ContentstackCommand.prototype, "uiHost"),
};

export const installCommandRuntimeMocks = (): void => {
  Object.defineProperty(ContentstackCommand.prototype, "getToken", {
    configurable: true,
    value: () => ({ authtoken: "test-management-token" }),
  });
  Object.defineProperty(ContentstackCommand.prototype, "region", {
    configurable: true,
    get: () => ({ name: "NA" }),
  });
  Object.defineProperty(ContentstackCommand.prototype, "cmaHost", {
    configurable: true,
    get: () => "api.contentstack.io",
  });
  Object.defineProperty(ContentstackCommand.prototype, "cdaHost", {
    configurable: true,
    get: () => "cdn.contentstack.io",
  });
  Object.defineProperty(ContentstackCommand.prototype, "cmaAPIUrl", {
    configurable: true,
    get: () => "https://api.contentstack.io",
  });
  Object.defineProperty(ContentstackCommand.prototype, "cdaAPIUrl", {
    configurable: true,
    get: () => "https://cdn.contentstack.io",
  });
  Object.defineProperty(ContentstackCommand.prototype, "uiHost", {
    configurable: true,
    get: () => "https://app.contentstack.com",
  });
};

export const restoreCommandRuntimeMocks = (): void => {
  for (const [key, descriptor] of Object.entries(runtimeDescriptors)) {
    if (descriptor) {
      Object.defineProperty(ContentstackCommand.prototype, key, descriptor);
    } else {
      delete runtimePrototype[key as keyof RuntimePrototype];
    }
  }
};

export const createJsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string): string | null {
        return headers[name] ?? headers[name.toLowerCase()] ?? null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;
