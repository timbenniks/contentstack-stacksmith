import type { CompiledEntity } from "@timbenniks/contentstack-stacksmith";

import type { ContentTypeRepository } from "./content-type-repository.js";
import type { GlobalFieldRepository } from "./global-field-repository.js";

export class ApplyExecutor {
  constructor(
    private readonly contentTypeRepository: ContentTypeRepository,
    private readonly globalFieldRepository: GlobalFieldRepository,
  ) {}

  async create(entity: CompiledEntity): Promise<void> {
    if (entity.kind === "content_type") {
      await this.contentTypeRepository.create(entity);
      return;
    }

    await this.globalFieldRepository.create(entity);
  }

  async update(entity: CompiledEntity): Promise<void> {
    if (entity.kind === "content_type") {
      await this.contentTypeRepository.update(entity);
      return;
    }

    await this.globalFieldRepository.update(entity);
  }
}
