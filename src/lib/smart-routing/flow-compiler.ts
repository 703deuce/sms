import type {
  CompiledFlow,
  CompiledNode,
  DraftConfig,
  DraftEdge,
  DraftNode,
} from "./types";
import { applyMenuBehaviorsToDraft } from "./menu-behaviors";

function edgeKey(conditionType: string, conditionValue?: string | null): string {
  if (conditionType === "always") return "always";
  if (conditionValue) return `${conditionType}:${conditionValue}`;
  return conditionType;
}

function buildEdgeMap(edges: DraftEdge[]): Map<string, Map<string, string>> {
  const byFrom = new Map<string, Map<string, string>>();
  const sorted = [...edges].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  for (const e of sorted) {
    if (!byFrom.has(e.fromNodeId)) byFrom.set(e.fromNodeId, new Map());
    const key = edgeKey(e.conditionType, e.conditionValue);
    byFrom.get(e.fromNodeId)!.set(key, e.toNodeId);
  }
  return byFrom;
}

function compileNode(node: DraftNode, edgeMap: Map<string, Map<string, string>>): CompiledNode {
  const edges: Record<string, string> = {};
  const nodeEdges = edgeMap.get(node.id);
  if (nodeEdges) {
    for (const [k, v] of nodeEdges.entries()) edges[k] = v;
  }
  return {
    id: node.id,
    type: node.type,
    config: { ...node.config, name: node.name },
    edges,
  };
}

export function compileDraftConfig(draft: DraftConfig): CompiledFlow {
  const normalizedDraft = applyMenuBehaviorsToDraft(draft);
  const nodes = normalizedDraft.nodes ?? [];
  const edges = normalizedDraft.edges ?? [];
  if (nodes.length === 0) {
    throw new Error("Flow has no nodes");
  }
  const entry = nodes.find((n) => n.type === "ENTRY") ?? nodes[0];
  const edgeMap = buildEdgeMap(edges);
  const compiledNodes: Record<string, CompiledNode> = {};
  for (const n of nodes) {
    compiledNodes[n.id] = compileNode(n, edgeMap);
  }

  // Merge menu options into MENU nodes when builder uses simplified UI
  if (normalizedDraft.menuOptions?.length) {
    for (const n of nodes) {
      if (n.type !== "MENU") continue;
      const routes: Record<string, string> = { ...compiledNodes[n.id].edges };
      for (const opt of normalizedDraft.menuOptions) {
        const target = edges.find(
          (e) => e.fromNodeId === n.id && e.conditionType === "digit" && e.conditionValue === opt.digit,
        );
        if (target) routes[`digit:${opt.digit}`] = target.toNodeId;
      }
      compiledNodes[n.id] = {
        ...compiledNodes[n.id],
        config: {
          ...compiledNodes[n.id].config,
          menuOptions: normalizedDraft.menuOptions,
          promptText:
            normalizedDraft.greeting?.text ??
            (compiledNodes[n.id].config.promptText as string | undefined),
          audioAssetId: normalizedDraft.greeting?.audioAssetId,
        },
        edges: routes,
      };
    }
  }

  if (normalizedDraft.greeting && entry) {
    compiledNodes[entry.id] = {
      ...compiledNodes[entry.id],
      config: {
        ...compiledNodes[entry.id].config,
        greeting: normalizedDraft.greeting,
      },
    };
  }

  return {
    entryNodeId: entry.id,
    nodes: compiledNodes,
  };
}
