import type {
  ProjectMapDataset,
  ProjectMapNode,
  ProjectMapRelation,
} from "../types";
import {
  buildProjectMapNodeIndex,
  compareProjectMapNodes,
  normalizeProjectMapProjectionNodes,
} from "./interactiveLayout";

export type ProjectMapSearchResult = {
  node: ProjectMapNode;
  score: number;
  matchedFields: string[];
};

export type ProjectMapPathStep = {
  node: ProjectMapNode;
  via: "hierarchy" | "relation" | "self";
  relation?: ProjectMapRelation;
};

export type ProjectMapPathResult =
  | {
      status: "idle";
      steps: [];
      edgeKeys: Set<string>;
      message: string;
    }
  | {
      status: "found";
      steps: ProjectMapPathStep[];
      edgeKeys: Set<string>;
      message: string;
    }
  | {
      status: "not-found";
      steps: [];
      edgeKeys: Set<string>;
      message: string;
    };

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function searchProjectMapNodes(input: {
  dataset: ProjectMapDataset;
  query: string;
  limit?: number;
}): ProjectMapSearchResult[] {
  const query = normalizeSearchText(input.query);
  if (!query) {
    return [];
  }
  const limit = input.limit ?? 8;
  return input.dataset.nodes
    .map((node) => {
      const fields = [
        ["title", node.title],
        ["summary", node.summary],
        ["kind", node.nodeKind],
        ["lens", node.lensId],
        ["source", node.sources.map((source) => `${source.label} ${source.path ?? ""}`).join(" ")],
      ] as const;
      const matchedFields = fields
        .filter(([, value]) => normalizeSearchText(String(value)).includes(query))
        .map(([field]) => field);
      const titleMatch = normalizeSearchText(node.title).includes(query);
      const score = matchedFields.length * 10 + (titleMatch ? 20 : 0) + node.children.length;
      return { node, score, matchedFields };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || compareProjectMapNodes(left.node, right.node))
    .slice(0, limit);
}

function edgeKey(sourceNodeId: string, targetNodeId: string): string {
  return `${sourceNodeId}::${targetNodeId}`;
}

function addPathNeighbor(
  adjacency: Map<string, ProjectMapPathStep[]>,
  fromNode: ProjectMapNode,
  toNode: ProjectMapNode | undefined,
  via: ProjectMapPathStep["via"],
  relation?: ProjectMapRelation,
): void {
  if (!toNode) {
    return;
  }
  const neighbors = adjacency.get(fromNode.id) ?? [];
  neighbors.push({ node: toNode, via, relation });
  adjacency.set(fromNode.id, neighbors);
}

export function buildProjectMapShortestPath(input: {
  dataset: ProjectMapDataset;
  sourceNodeId: string | null;
  targetNodeId: string | null;
  emptyMessage: string;
  foundMessage: string;
  notFoundMessage: string;
}): ProjectMapPathResult {
  const sourceNodeId = input.sourceNodeId?.trim() ?? "";
  const targetNodeId = input.targetNodeId?.trim() ?? "";
  if (!sourceNodeId || !targetNodeId) {
    return { status: "idle", steps: [], edgeKeys: new Set(), message: input.emptyMessage };
  }

  const nodes = normalizeProjectMapProjectionNodes(input.dataset.nodes);
  const nodeIndex = buildProjectMapNodeIndex(nodes);
  const sourceNode = nodeIndex.get(sourceNodeId);
  const targetNode = nodeIndex.get(targetNodeId);
  if (!sourceNode || !targetNode) {
    return { status: "not-found", steps: [], edgeKeys: new Set(), message: input.notFoundMessage };
  }
  if (sourceNode.id === targetNode.id) {
    return {
      status: "found",
      steps: [{ node: sourceNode, via: "self" }],
      edgeKeys: new Set(),
      message: input.foundMessage,
    };
  }

  const adjacency = new Map<string, ProjectMapPathStep[]>();
  for (const node of nodes) {
    addPathNeighbor(adjacency, node, node.parentId ? nodeIndex.get(node.parentId) : undefined, "hierarchy");
    for (const childId of node.children) {
      addPathNeighbor(adjacency, node, nodeIndex.get(childId), "hierarchy");
    }
  }
  for (const relation of input.dataset.relations ?? []) {
    const source = nodeIndex.get(relation.sourceNodeId);
    const target = nodeIndex.get(relation.targetNodeId);
    if (!source || !target) {
      continue;
    }
    if (relation.direction !== "backward") {
      addPathNeighbor(adjacency, source, target, "relation", relation);
    }
    if (relation.direction !== "forward") {
      addPathNeighbor(adjacency, target, source, "relation", relation);
    }
  }

  const queue = [sourceNode.id];
  const previous = new Map<string, { previousNodeId: string; step: ProjectMapPathStep }>();
  const visited = new Set<string>([sourceNode.id]);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    for (const neighbor of adjacency.get(currentNodeId) ?? []) {
      if (visited.has(neighbor.node.id)) {
        continue;
      }
      visited.add(neighbor.node.id);
      previous.set(neighbor.node.id, { previousNodeId: currentNodeId, step: neighbor });
      if (neighbor.node.id === targetNode.id) {
        queue.length = 0;
        break;
      }
      queue.push(neighbor.node.id);
    }
  }

  if (!previous.has(targetNode.id)) {
    return { status: "not-found", steps: [], edgeKeys: new Set(), message: input.notFoundMessage };
  }

  const reversedSteps: ProjectMapPathStep[] = [];
  let currentNodeId = targetNode.id;
  while (currentNodeId !== sourceNode.id) {
    const previousEntry = previous.get(currentNodeId);
    if (!previousEntry) {
      break;
    }
    reversedSteps.push(previousEntry.step);
    currentNodeId = previousEntry.previousNodeId;
  }
  const steps: ProjectMapPathStep[] = [{ node: sourceNode, via: "self" }, ...reversedSteps.reverse()];
  const edgeKeys = new Set<string>();
  for (let index = 1; index < steps.length; index += 1) {
    const fromNodeId = steps[index - 1]?.node.id;
    const toNodeId = steps[index]?.node.id;
    if (fromNodeId && toNodeId) {
      edgeKeys.add(edgeKey(fromNodeId, toNodeId));
      edgeKeys.add(edgeKey(toNodeId, fromNodeId));
    }
  }

  return { status: "found", steps, edgeKeys, message: input.foundMessage };
}
