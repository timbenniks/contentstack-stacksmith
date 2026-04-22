import { buildDependencyGraph } from "../graph/build-dependency-graph.js";
import type {
  DependencyGraph,
  DiffResult,
  PlanArtifact,
  PlanOperation,
  PlanSummary,
  ValidationFinding,
} from "../schema/types.js";

const applyOperationOrdering = (operations: PlanOperation[], graph: DependencyGraph): PlanOperation[] => {
  const orderIndex = new Map(graph.order.map((entityId, index) => [entityId, index]));

  return [...operations].sort((left, right) => {
    const leftIndex = orderIndex.get(left.entity.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.entity.id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.id.localeCompare(right.id);
  });
};

const summarize = (operations: PlanOperation[]): PlanSummary => ({
  total: operations.length,
  creates: operations.filter((operation) => operation.kind === "create_entity" || operation.kind === "add_field").length,
  updates: operations.filter((operation) =>
    ["update_entity", "update_field", "reorder_fields", "rename_field"].includes(operation.kind),
  ).length,
  deletes: operations.filter((operation) =>
    ["delete_entity", "remove_field"].includes(operation.kind),
  ).length,
  blocked: operations.filter((operation) => operation.status === "blocked").length,
  lowRisk: operations.filter((operation) => operation.risks.length > 0 && operation.risks.every((risk) => risk.level === "low")).length,
  mediumRisk: operations.filter((operation) =>
    operation.risks.some((risk) => risk.level === "medium"),
  ).length,
  highRisk: operations.filter((operation) =>
    operation.risks.some((risk) => risk.level === "high" || risk.level === "blocker"),
  ).length,
});

/**
 * Create a dependency-aware execution plan from a diff result.
 * Orders operations by dependency graph, attaches validation risks, and summarizes.
 * @param diff - The diff result from diffSchemas
 * @param graph - Optional pre-built dependency graph; built from local schema if omitted
 * @param validationFindings - Optional validation findings to attach as risks to operations
 * @returns Plan artifact with ordered operations, summary, and dependency info
 */
export const createPlan = (
  diff: DiffResult,
  graph = buildDependencyGraph(diff.local),
  validationFindings: ValidationFinding[] = [],
): PlanArtifact => {
  const operations = applyOperationOrdering(diff.operations, graph).map((operation) => {
    const relatedFindings = validationFindings.filter(
      (finding) =>
        finding.operationId === operation.id ||
        finding.entityId === operation.entity.id ||
        (operation.fieldUid && finding.fieldId === `${operation.entity.id}.field:${operation.fieldUid}`),
    );

    const risks = relatedFindings.map((finding) => ({
      level: finding.level,
      code: finding.code,
      message: finding.message,
      entityId: finding.entityId,
      fieldId: finding.fieldId,
    }));

    const status = risks.some((risk) => risk.level === "blocker") ? "blocked" : operation.status;

    return {
      ...operation,
      status,
      risks,
      dependencies: (
        (operation.kind === "delete_entity" || operation.kind === "remove_field"
          ? diff.remote.entities
          : diff.local.entities
        ).find((entity) => entity.id === operation.entity.id)
          ?.dependencies.map((dependency) => dependency.targetEntityId) ?? []
      ),
    };
  });

  const dependencyNotes = graph.edges.map((edge) => edge.description);

  return {
    schemaVersion: diff.local.schemaVersion,
    operations,
    summary: summarize(operations),
    dependencyOrder: graph.order,
    dependencyNotes,
    validationFindings,
  };
};
