import type { DependencyGraph, EntityRef, SchemaArtifact } from "../schema/types.js";

const detectCycles = (nodes: string[], edges: Map<string, Set<string>>): string[][] => {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  const visit = (node: string, path: string[]): void => {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    for (const dependency of edges.get(node) ?? []) {
      visit(dependency, [...path, node]);
    }

    stack.delete(node);
  };

  for (const node of nodes) visit(node, []);

  return cycles;
};

/**
 * Build a dependency graph from a schema artifact using topological sort.
 * Detects cycles and dangling references.
 * @param schema - Normalized schema artifact
 * @returns Dependency graph with topological order, cycle info, and warnings
 */
export const buildDependencyGraph = (schema: SchemaArtifact): DependencyGraph => {
  const nodes: EntityRef[] = schema.entities.map((entity) => ({ id: entity.id, kind: entity.kind, uid: entity.uid }));
  const dependencyMap = new Map<string, Set<string>>();
  const dependentsMap = new Map<string, Set<string>>();
  const indegrees = new Map<string, number>();
  const warnings: string[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    dependencyMap.set(node.id, new Set());
    dependentsMap.set(node.id, new Set());
    indegrees.set(node.id, 0);
  }

  for (const entity of schema.entities) {
    for (const dependency of entity.dependencies) {
      if (!nodeIds.has(dependency.targetEntityId)) {
        warnings.push(`Dangling reference: ${entity.uid} depends on ${dependency.targetEntityId} which is not in the schema.`);
        continue;
      }
      dependencyMap.get(entity.id)?.add(dependency.targetEntityId);
      dependentsMap.get(dependency.targetEntityId)?.add(entity.id);
    }
  }

  for (const node of nodes) {
    indegrees.set(node.id, dependencyMap.get(node.id)?.size ?? 0);
  }

  const sortedInsert = (arr: string[], value: string): void => {
    let low = 0;
    let high = arr.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (arr[mid]! < value) low = mid + 1;
      else high = mid;
    }
    arr.splice(low, 0, value);
  };

  const queue = nodes
    .map((node) => node.id)
    .filter((nodeId) => (indegrees.get(nodeId) ?? 0) === 0)
    .sort();

  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const dependent of [...(dependentsMap.get(current) ?? [])].sort()) {
      const nextIndegree = (indegrees.get(dependent) ?? 0) - 1;
      indegrees.set(dependent, nextIndegree);

      if (nextIndegree === 0) {
        sortedInsert(queue, dependent);
      }
    }
  }

  const cycles = detectCycles(
    nodes.map((node) => node.id),
    dependencyMap,
  );

  let completeOrder: string[];
  if (order.length === nodes.length) {
    completeOrder = order;
  } else {
    const orderSet = new Set(order);
    const remaining = nodes.map((node) => node.id).filter((nodeId) => !orderSet.has(nodeId)).sort();
    completeOrder = [...order, ...remaining];
  }

  return {
    nodes,
    edges: schema.entities.flatMap((entity) => entity.dependencies),
    order: completeOrder,
    reverseOrder: [...completeOrder].reverse(),
    cycles,
    warnings,
  };
};
