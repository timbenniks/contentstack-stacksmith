import type { CompiledEntity } from "@timbenniks/contentstack-stacksmith";

import type { ManagementClient } from "./management-client-factory.js";
import { paginate } from "./paginate.js";
import { RemoteSchemaMapper } from "./remote-schema-mapper.js";

export class GlobalFieldRepository {
  constructor(
    private readonly client: ManagementClient,
    private readonly mapper = new RemoteSchemaMapper(),
  ) {}

  async list(): Promise<Record<string, unknown>[]> {
    return paginate({
      client: this.client,
      path: "/v3/global_fields",
      itemsKey: "global_fields",
      requestOptions: { apiVersion: "3.2" },
    });
  }

  async create(entity: CompiledEntity): Promise<void> {
    await this.client.request("/v3/global_fields", {
      method: "POST",
      apiVersion: "3.2",
      body: JSON.stringify(this.mapper.toContentstackEntity(entity)),
    });
  }

  async update(entity: CompiledEntity): Promise<void> {
    await this.client.request(`/v3/global_fields/${entity.uid}`, {
      method: "PUT",
      apiVersion: "3.2",
      body: JSON.stringify(this.mapper.toContentstackEntity(entity)),
    });
  }
}
