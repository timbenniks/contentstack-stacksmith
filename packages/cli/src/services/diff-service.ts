import { diffSchemas, type DiffResult, type SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

export class DiffService {
  create(local: SchemaArtifact, remote: SchemaArtifact): DiffResult {
    return diffSchemas(local, remote);
  }
}
