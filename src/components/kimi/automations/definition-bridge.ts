import { getBlock } from "@/lib/automations/catalog";
import { isConditionBlock } from "@/lib/automations/catalog";
import { createEdgeId, nodeSummary, type AutomationCanvasEdge, type AutomationDefinition, type AutomationCanvasNode } from "@/lib/automations/types";
import {
  blockTypeForKimiId,
  kimiIdForBlockType,
  kimiKindForBlock,
  paletteItemForBlockType,
  paletteItemForKimiId,
} from "./block-bridge";
import type { CanvasEdge, CanvasNodeData, NodeOutput } from "./WorkflowBuilder";

function outputsForKind(kind: CanvasNodeData["kind"], blockType: string): NodeOutput[] {
  if (kind === "condition" || isConditionBlock(blockType)) {
    return [
      { label: "Yes", kind: "yes", pie: true },
      { label: "No", kind: "no", pie: true },
    ];
  }
  if (kind === "wait" || blockType.startsWith("wait_for_")) {
    return [
      { label: "Found", kind: "yes", pie: true },
      { label: "Not Found", kind: "no", pie: true },
    ];
  }
  const block = getBlock(blockType);
  if (block?.blockType === "send_sms") {
    return [
      { label: "Message Sent", kind: "yes", pie: true },
      { label: "Failed", kind: "no", pie: true },
    ];
  }
  return [{ label: "", kind: "neutral" }];
}

function handleFromEdgeLabel(label: string, kind: CanvasEdge["kind"]): string {
  if (kind === "yes") return "yes";
  if (kind === "no") return "no";
  if (label.toLowerCase() === "yes") return "yes";
  if (label.toLowerCase() === "no") return "no";
  return "default";
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
    return {
      id: n.id,
      itemId: kimiId,
      label: n.data.label || palette?.label || blockType,
      kind,
      icon: palette?.icon ?? "MessageSquare",
      x: n.position.x,
      y: n.position.y,
      configured,
      subtitle: configured ? nodeSummary(n) : "Not configured",
      outputs: outputsForKind(kind, blockType),
    };
  });

  const edges: CanvasEdge[] = def.edges.map((e) => {
    const handle = e.sourceHandle || "default";
    const kind: CanvasEdge["kind"] =
      handle === "yes" ? "yes" : handle === "no" ? "no" : "neutral";
    const label =
      handle === "yes" ? "Yes" : handle === "no" ? "No" : handle === "default" ? "" : handle;
    return {
      id: e.id,
      from: e.source,
      to: e.target,
      label,
      kind,
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
    };

    if (blockType === "send_sms" && n.subtitle && n.subtitle !== "Not configured") {
      config.messageName = n.subtitle;
      if (!config.body) config.body = n.subtitle;
    }
    if (blockType === "assign_inbox_conversation" && n.subtitle && n.subtitle !== "Not configured") {
      config.assigneeName = n.subtitle;
    }

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
    sourceHandle: handleFromEdgeLabel(e.label, e.kind),
    targetHandle: null,
  }));

  return {
    version: 1,
    nodes: canvasNodes,
    edges: canvasEdges,
    viewport: existing.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}
