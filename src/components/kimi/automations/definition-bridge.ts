import { getBlock, isConditionBlock } from "@/lib/automations/catalog";
import { getBlockOutcomes } from "@/lib/automations/block-registry/outcomes";
import {
  createEdgeId,
  nodeSummary,
  type AutomationCanvasEdge,
  type AutomationDefinition,
  type AutomationCanvasNode,
} from "@/lib/automations/types";
import {
  blockTypeForKimiId,
  kimiIdForBlockType,
  kimiKindForBlock,
  paletteItemForBlockType,
  paletteItemForKimiId,
} from "./block-bridge";
import {
  outcomesToKimiOutputs,
  handleFromKimiEdge,
  kimiEdgeFromHandle,
  type KimiNodeOutput,
} from "@/lib/automations/outcome-ui";
import type { CanvasEdge, CanvasNodeData } from "./WorkflowBuilder";

export type { KimiNodeOutput };

function outputsForNode(
  blockType: string,
  config?: Record<string, unknown>,
): KimiNodeOutput[] {
  return outcomesToKimiOutputs(blockType, config);
}

export function definitionToKimi(def: AutomationDefinition): {
  nodes: CanvasNodeData[];
  edges: CanvasEdge[];
} {
  const nodes: CanvasNodeData[] = def.nodes.map((n) => {
    const blockType = n.data.blockType;
    const palette = paletteItemForBlockType(blockType);
    const kimiId = palette?.id ?? kimiIdForBlockType(blockType) ?? blockType;
    const kind = palette?.kind ?? kimiKindForBlock(blockType);
    const configured = Object.keys(n.data.config || {}).length > 0;
    const subtitle = configured ? nodeSummary(n) : "Not configured";
    return {
      id: n.id,
      itemId: kimiId,
      label: n.data.label || palette?.label || blockType,
      kind,
      icon: palette?.icon ?? "MessageSquare",
      x: n.position.x,
      y: n.position.y,
      configured,
      subtitle,
      config: n.data.config || {},
      outputs: outputsForNode(blockType, n.data.config),
    };
  });

  const edges: CanvasEdge[] = def.edges.map((e) => {
    const sourceNode = def.nodes.find((n) => n.id === e.source);
    const blockType = sourceNode?.data.blockType || "";
    const outcomes = getBlockOutcomes(blockType, sourceNode?.data.config);
    const handle = e.sourceHandle || "default";
    const mapped = kimiEdgeFromHandle(handle, outcomes);
    return {
      id: e.id,
      from: e.source,
      to: e.target,
      label: mapped.label,
      kind: mapped.kind,
      outcomeId: mapped.outcomeId,
    };
  });

  return { nodes, edges };
}

export function kimiToDefinition(
  nodes: CanvasNodeData[],
  edges: CanvasEdge[],
  existing: AutomationDefinition,
): AutomationDefinition {
  const existingById = new Map(existing.nodes.map((n) => [n.id, n]));

  const canvasNodes: AutomationCanvasNode[] = nodes.map((n) => {
    const blockType = blockTypeForKimiId(n.itemId);
    const block = getBlock(blockType);
    const prior = existingById.get(n.id);
    const category = block?.category;
    const type =
      category === "trigger"
        ? "trigger"
        : category === "end"
          ? "end"
          : category === "logic" || isConditionBlock(blockType)
            ? "logic"
            : "action";

    const config: Record<string, unknown> = {
      ...(block?.defaultConfig ?? {}),
      ...(prior?.data.config ?? {}),
      ...(n.config ?? {}),
    };

    const canvasNode: AutomationCanvasNode = {
      id: n.id,
      type,
      position: { x: n.x, y: n.y },
      data: {
        blockType,
        label: n.label,
        config,
      },
    };
    canvasNode.data.label = nodeSummary(canvasNode);
    return canvasNode;
  });

  const canvasEdges: AutomationCanvasEdge[] = edges.map((e) => ({
    id: e.id || createEdgeId(),
    source: e.from,
    target: e.to,
    sourceHandle: handleFromKimiEdge(e.outcomeId || e.label || "default"),
    targetHandle: null,
  }));

  return {
    version: 1,
    nodes: canvasNodes,
    edges: canvasEdges,
    viewport: existing.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

/** Refresh node outputs after config change (e.g. split traffic path count). */
export function refreshNodeOutputs(node: CanvasNodeData): CanvasNodeData {
  const blockType = blockTypeForKimiId(node.itemId);
  return {
    ...node,
    outputs: outputsForNode(blockType, node.config),
  };
}
