/**
 * Visual AI call-flow graph types.
 * Two layers share the same canvas shape: Call Routing + AI Conversation.
 * Transovo draftConfig is source of truth; graphs compile into Telnyx + routing.
 */

export type VoiceFlowLayer = "routing" | "conversation";

export type VoiceFlowNodeCategory =
  | "entry"
  | "routing"
  | "conversation"
  | "logic"
  | "tools"
  | "crm"
  | "messaging"
  | "handoff"
  | "end";

export type VoiceFlowNode = {
  id: string;
  type: VoiceFlowNodeCategory;
  position: { x: number; y: number };
  data: {
    blockType: string;
    label: string;
    config: Record<string, unknown>;
  };
};

export type VoiceFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type VoiceFlowGraph = {
  version: number;
  nodes: VoiceFlowNode[];
  edges: VoiceFlowEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export type VoiceGlobalRule = {
  id: string;
  name: string;
  trigger:
    | "want_person"
    | "stop"
    | "callback"
    | "emergency"
    | "repeat"
    | "language_switch"
    | "tool_failure"
    | "abusive";
  enabled: boolean;
  destinationBlockType?: string;
  transferTargetName?: string;
  instructions?: string;
};

export type VoiceFlowBundle = {
  routing: VoiceFlowGraph;
  conversation: VoiceFlowGraph;
  globalRules: VoiceGlobalRule[];
};

export const EMPTY_GRAPH: VoiceFlowGraph = {
  version: 1,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export function parseVoiceFlowGraph(raw: unknown): VoiceFlowGraph {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_GRAPH, nodes: [], edges: [] };
  }
  const obj = raw as Partial<VoiceFlowGraph>;
  return {
    version: obj.version ?? 1,
    nodes: Array.isArray(obj.nodes) ? (obj.nodes as VoiceFlowNode[]) : [],
    edges: Array.isArray(obj.edges) ? (obj.edges as VoiceFlowEdge[]) : [],
    viewport: obj.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

export function parseGlobalRules(raw: unknown): VoiceGlobalRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Partial<VoiceGlobalRule>;
      return {
        id: String(o.id || cryptoRandom()),
        name: String(o.name || "Global rule"),
        trigger: (o.trigger || "want_person") as VoiceGlobalRule["trigger"],
        enabled: o.enabled !== false,
        destinationBlockType: o.destinationBlockType,
        transferTargetName: o.transferTargetName,
        instructions: o.instructions,
      };
    });
}

export function parseVoiceFlowBundle(raw: unknown): VoiceFlowBundle {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    routing: parseVoiceFlowGraph(obj.routing),
    conversation: parseVoiceFlowGraph(obj.conversation),
    globalRules: parseGlobalRules(obj.globalRules),
  };
}

export function createNodeId() {
  return `vn_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEdgeId() {
  return `ve_${Math.random().toString(36).slice(2, 10)}`;
}

function cryptoRandom() {
  return `gr_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOutgoing(
  graph: VoiceFlowGraph,
  nodeId: string,
  handle?: string,
): VoiceFlowEdge[] {
  return graph.edges.filter((e) => {
    if (e.source !== nodeId) return false;
    if (!handle) return true;
    return (e.sourceHandle || "default") === handle;
  });
}

export function nodeSummary(node: VoiceFlowNode): string {
  const c = node.data.config || {};
  switch (node.data.blockType) {
    case "business_hours":
      return "Business hours check";
    case "ring_group":
      return `Ring ${c.seconds || 25}s`;
    case "ai_assistant":
      return String(c.agentLabel || "AI assistant");
    case "transfer":
      return String(c.targetName || "Named transfer");
    case "send_sms":
      return "Send approved SMS";
    case "search_crm_contacts":
      return "CRM contact search";
    case "take_message":
      return "Structured message";
    case "greeting":
      return String(c.text || "Greeting").slice(0, 48);
    case "condition":
      return String(c.label || c.field || "Condition");
    default:
      return node.data.blockType.replace(/_/g, " ");
  }
}
