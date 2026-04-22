import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { toCanonicalJson } from "@timbenniks/contentstack-stacksmith";
import type { PlanArtifact, SchemaArtifact } from "@timbenniks/contentstack-stacksmith";

import { ApplyExecutor } from "../integrations/contentstack/apply-executor.js";
import { ContentTypeRepository } from "../integrations/contentstack/content-type-repository.js";
import { GlobalFieldRepository } from "../integrations/contentstack/global-field-repository.js";
import { ManagementClientFactory, type ManagementClientOptions } from "../integrations/contentstack/management-client-factory.js";

export interface ApplyOperationFailure {
  operationId: string;
  entityId: string;
  error: string;
}

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  failed: ApplyOperationFailure[];
  stateFilePath?: string;
}

export interface ApplyStateFile {
  schemaHash: string;
  applied: string[];
  failed: ApplyOperationFailure[];
  timestamp: string;
}

export interface ApplyOptions {
  outDir?: string;
  resetState?: boolean;
}

export class StaleApplyStateError extends Error {
  constructor(public readonly stateFilePath: string) {
    super(
      `The local schema has changed since the last apply. Previous state at ${stateFilePath} is stale. Re-run with --reset-state to discard it and start over.`,
    );
    this.name = "StaleApplyStateError";
  }
}

const updatableKinds = new Set(["update_entity", "add_field", "update_field", "reorder_fields", "rename_field"]);

export const hashSchema = (schema: SchemaArtifact): string =>
  createHash("sha256").update(toCanonicalJson(schema)).digest("hex");

export class ApplyService {
  constructor(private readonly managementClientFactory = new ManagementClientFactory()) {}

  async apply(
    plan: PlanArtifact,
    local: SchemaArtifact,
    remoteOptions: ManagementClientOptions,
    options: ApplyOptions = {},
  ): Promise<ApplyResult> {
    if (plan.operations.some((operation) => operation.status === "blocked")) {
      throw new Error("Plan contains blocked operations. Resolve them before applying.");
    }

    if (plan.operations.some((operation) => operation.risks.some((risk) => risk.level !== "low"))) {
      throw new Error("Apply only supports low-risk operations in phase 1.");
    }

    const { outDir, resetState = false } = options;
    const stateFilePath = outDir ? join(outDir, "apply-state.json") : undefined;
    const schemaHash = hashSchema(local);
    const applied = new Set<string>();
    const skipped: string[] = [];

    if (stateFilePath) {
      if (resetState) {
        await rm(stateFilePath, { force: true });
      } else {
        const prior = await readApplyStateFile(stateFilePath);
        if (prior) {
          if (prior.schemaHash !== schemaHash) {
            throw new StaleApplyStateError(stateFilePath);
          }
          for (const entry of prior.applied) {
            applied.add(entry);
            skipped.push(entry);
          }
        }
      }
    }

    const client = this.managementClientFactory.create(remoteOptions);
    const executor = new ApplyExecutor(new ContentTypeRepository(client), new GlobalFieldRepository(client));
    const localEntities = new Map(local.entities.map((entity) => [entity.id, entity]));
    const failed: ApplyOperationFailure[] = [];

    for (const operation of plan.operations) {
      const entity = localEntities.get(operation.entity.id);
      if (!entity) continue;

      try {
        if (operation.kind === "create_entity" && !applied.has(`create:${entity.id}`)) {
          await executor.create(entity);
          applied.add(`create:${entity.id}`);
        }

        if (updatableKinds.has(operation.kind) && !applied.has(`update:${entity.id}`)) {
          await executor.update(entity);
          applied.add(`update:${entity.id}`);
        }
      } catch (error) {
        failed.push({
          operationId: operation.id,
          entityId: entity.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result: ApplyResult = { applied: [...applied], skipped, failed };

    if (stateFilePath) {
      if (failed.length > 0) {
        const payload: ApplyStateFile = {
          schemaHash,
          applied: result.applied,
          failed,
          timestamp: new Date().toISOString(),
        };
        await writeFile(stateFilePath, JSON.stringify(payload, null, 2));
        result.stateFilePath = stateFilePath;
      } else {
        await rm(stateFilePath, { force: true });
      }
    }

    return result;
  }
}

const readApplyStateFile = async (path: string): Promise<ApplyStateFile | undefined> => {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<ApplyStateFile>;
    if (typeof parsed.schemaHash !== "string" || !Array.isArray(parsed.applied)) return undefined;
    return {
      schemaHash: parsed.schemaHash,
      applied: parsed.applied,
      failed: Array.isArray(parsed.failed) ? parsed.failed : [],
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : "",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};
