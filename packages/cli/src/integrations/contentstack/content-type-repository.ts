import type { CompiledEntity } from "@timbenniks/contentstack-stacksmith";

import type { ManagementClient } from "./management-client-factory.js";
import { paginate } from "./paginate.js";
import { RemoteSchemaMapper } from "./remote-schema-mapper.js";

export class ContentTypeRepository {
  constructor(
    private readonly client: ManagementClient,
    private readonly mapper = new RemoteSchemaMapper(),
  ) {}

  async list(): Promise<Record<string, unknown>[]> {
    return paginate({
      client: this.client,
      path: "/v3/content_types",
      itemsKey: "content_types",
    });
  }

  async create(entity: CompiledEntity): Promise<void> {
    await this.client.request("/v3/content_types", {
      method: "POST",
      body: JSON.stringify(this.mapper.toContentstackEntity(entity)),
    });
  }

  async update(entity: CompiledEntity): Promise<void> {
    await this.client.request(`/v3/content_types/${entity.uid}`, {
      method: "PUT",
      body: JSON.stringify(this.mapper.toContentstackEntity(entity)),
    });
  }
}
