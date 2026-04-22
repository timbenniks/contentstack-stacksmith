import { buildDependencyGraph, createPlan, type PlanArtifact, type SchemaArtifact } from "@timbenniks/contentstack-stacksmith";
import { analyzePlanRisk, validateDiff, validateSchema } from "@timbenniks/contentstack-stacksmith";

import { DiffService } from "./diff-service.js";

export class PlanService {
  constructor(private readonly diffService = new DiffService()) {}

  create(local: SchemaArtifact, remote: SchemaArtifact): PlanArtifact {
    const diff = this.diffService.create(local, remote);
    const graph = buildDependencyGraph(local);
    const validationFindings = [...validateSchema(local), ...validateDiff(diff)];
    const plan = createPlan(diff, graph, validationFindings);
    const planRiskFindings = analyzePlanRisk(plan);

    return {
      ...plan,
      validationFindings: [...plan.validationFindings, ...planRiskFindings],
    };
  }
}
