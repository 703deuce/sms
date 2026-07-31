/**
 * Automation builder graph types and parsing.
 */

export type AutomationNodeCategory = "trigger" | "action" | "logic" | "end";

export type AutomationCanvasNode = {
  id: string;
  type: AutomationNodeCategory;
  position: { x: number; y: number };
  data: {
    blockType: string;
    label: string;
    config: Record<string, unknown>;
  };
};

export type AutomationCanvasEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type AutomationDefinition = {
  version: number;
  nodes: AutomationCanvasNode[];
  edges: AutomationCanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export const EMPTY_DEFINITION: AutomationDefinition = {
  version: 1,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export function parseAutomationDefinition(raw: unknown): AutomationDefinition {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DEFINITION, nodes: [], edges: [] };
  const obj = raw as Partial<AutomationDefinition>;
  const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  const edges = Array.isArray(obj.edges) ? obj.edges : [];
  return {
    version: obj.version ?? 1,
    nodes,
    edges,
    viewport: obj.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

export function findTriggerNode(def: AutomationDefinition): AutomationCanvasNode | null {
  return def.nodes.find((n) => n.type === "trigger") ?? null;
}

export function findNode(def: AutomationDefinition, nodeId: string | null | undefined) {
  if (!nodeId) return null;
  return def.nodes.find((n) => n.id === nodeId) ?? null;
}

export function getOutgoingEdges(def: AutomationDefinition, nodeId: string, handle?: string) {
  return def.edges.filter((e) => {
    if (e.source !== nodeId) return false;
    if (!handle) return !e.sourceHandle || e.sourceHandle === "default";
    return e.sourceHandle === handle;
  });
}

export function getNextNodeId(
  def: AutomationDefinition,
  nodeId: string,
  branch?: "yes" | "no" | "default",
): string | null {
  const handle = branch ?? "default";
  const edge = def.edges.find(
    (e) => e.source === nodeId && (e.sourceHandle || "default") === handle,
  );
  return edge?.target ?? null;
}

export function nodeSummary(node: AutomationCanvasNode): string {
  const cfg = node.data.config || {};
  const block = node.data.blockType;

  if (block === "wait") {
    const days = Number(cfg.days || 0);
    const hours = Number(cfg.hours || 0);
    const minutes = Number(cfg.minutes || 0);
    const parts: string[] = [];
    if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    if (minutes) parts.push(`${minutes} min`);
    return parts.length ? `Wait ${parts.join(" ")}` : "Wait";
  }

  if (block === "condition" || node.type === "logic") {
    const field = String(cfg.field || "review_received");
    return `If ${field.replace(/_/g, " ")}`;
  }

  if (block === "send_sms" || block === "send_review_request") {
    const body = String(cfg.body || "").trim();
    return body.length > 40 ? `${body.slice(0, 40)}…` : body || node.data.label;
  }

  if (block === "end_automation") return "End automation";

  return node.data.label || block;
}

export function createNodeId() {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEdgeId() {
  return `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function waitDurationMs(config: Record<string, unknown> | undefined): number {
  const days = Number(config?.days || 0);
  const hours = Number(config?.hours || 0);
  const minutes = Number(config?.minutes || 0);
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000;
  return Math.max(ms, 60_000);
}
