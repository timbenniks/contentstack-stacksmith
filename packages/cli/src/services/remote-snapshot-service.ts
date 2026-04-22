import { normalizeSchema, type SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

import { ContentTypeRepository } from "../integrations/contentstack/content-type-repository.js";
import { GlobalFieldRepository } from "../integrations/contentstack/global-field-repository.js";
import { ManagementClientFactory } from "../integrations/contentstack/management-client-factory.js";
import { RemoteSchemaMapper } from "../integrations/contentstack/remote-schema-mapper.js";
import type { ResolvedToken } from "../utils/token.js";

export interface RemoteSnapshotInput {
  stackApiKey?: string | undefined;
  managementToken?: string | ResolvedToken | undefined;
  cmaBaseUrl?: string | undefined;
  branch?: string | undefined;
}

const hasToken = (value: string | ResolvedToken | undefined): value is string | ResolvedToken => {
  if (!value) return false;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value.token);
};

export class RemoteSnapshotService {
  constructor(
    private readonly managementClientFactory = new ManagementClientFactory(),
    private readonly mapper = new RemoteSchemaMapper(),
  ) {}

  async load(input: RemoteSnapshotInput): Promise<SchemaArtifact> {
    if (!input.stackApiKey) {
      return normalizeSchema({ entities: [], metadata: { origin: "remote" } });
    }

    if (!hasToken(input.managementToken) || !input.cmaBaseUrl) {
      throw new Error(
        "A management token is required when --stack is provided. Pass --management-token, --token-alias, run csdx auth:login, or set CS_AUTHTOKEN.",
      );
    }

    const client = this.managementClientFactory.create({
      stackApiKey: input.stackApiKey,
      managementToken: input.managementToken,
      cmaBaseUrl: input.cmaBaseUrl,
      branch: input.branch,
    });

    const contentTypeRepository = new ContentTypeRepository(client);
    const globalFieldRepository = new GlobalFieldRepository(client);
    const [contentTypes, globalFields] = await Promise.all([
      contentTypeRepository.list(),
      globalFieldRepository.list(),
    ]);

    return this.mapper.toSchemaArtifact(contentTypes, globalFields);
  }
}
