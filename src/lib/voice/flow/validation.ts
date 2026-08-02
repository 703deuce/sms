import { getVoiceFlowBlock, isBranchingBlock } from "./catalog";
import type { VoiceFlowBundle, VoiceFlowGraph, VoiceFlowNode } from "./types";

export type FlowIssue = {
  layer?: "routing" | "conversation" | "global";
  nodeId?: string;
  message: string;
  severity: "error" | "warning";
};

export function validateVoiceFlowBundle(bundle: VoiceFlowBundle): FlowIssue[] {
  const issues: FlowIssue[] = [];
  issues.push(...validateGraph("routing", bundle.routing));
  issues.push(...validateGraph("conversation", bundle.conversation));

  const routingEntry = bundle.routing.nodes.find(
    (n) => n.data.blockType === "incoming_call",
  );
  if (!routingEntry && bundle.routing.nodes.length) {
    issues.push({
      layer: "routing",
      severity: "error",
      message: "Routing flow needs an Incoming call entry node.",
    });
  }

  const hasAiPath = bundle.routing.nodes.some((n) =>
    ["ai_assistant", "no_answer_ai", "after_hours_ai"].includes(n.data.blockType),
  );
  if (bundle.routing.nodes.length && !hasAiPath) {
    issues.push({
      layer: "routing",
      severity: "warning",
      message: "No AI assistant node in routing — calls may never reach the AI conversation flow.",
    });
  }

  const greeting = bundle.conversation.nodes.find((n) => n.data.blockType === "greeting");
  if (bundle.conversation.nodes.length && !greeting) {
    issues.push({
      layer: "conversation",
      severity: "warning",
      message: "Conversation flow has no Greeting node.",
    });
  }

  const end = bundle.conversation.nodes.find((n) => n.data.blockType === "end_call");
  if (bundle.conversation.nodes.length && !end) {
    issues.push({
      layer: "conversation",
      severity: "warning",
      message: "Conversation flow has no End call node.",
    });
  }

  const wantPerson = bundle.globalRules.find((r) => r.trigger === "want_person" && r.enabled);
  if (!wantPerson) {
    issues.push({
      layer: "global",
      severity: "warning",
      message: "Add a global rule for callers who ask for a real person.",
    });
  }

  for (const node of [...bundle.routing.nodes, ...bundle.conversation.nodes]) {
    if (node.data.blockType === "transfer" || node.data.blockType === "escalate_human") {
      const target = String(node.data.config?.targetName || "").trim();
      if (!target) {
        issues.push({
          nodeId: node.id,
          severity: "error",
          message: `${node.data.label}: transfer target name is required.`,
        });
      }
    }
  }

  return issues;
}

function validateGraph(
  layer: "routing" | "conversation",
  graph: VoiceFlowGraph,
): FlowIssue[] {
  const issues: FlowIssue[] = [];
  if (!graph.nodes.length) {
    issues.push({
      layer,
      severity: "error",
      message: `${layer} flow is empty.`,
    });
    return issues;
  }

  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({
        layer,
        severity: "error",
        message: "Flow has an edge pointing to a missing node.",
      });
    }
  }

  for (const node of graph.nodes) {
    const block = getVoiceFlowBlock(node.data.blockType);
    if (!block) {
      issues.push({
        layer,
        nodeId: node.id,
        severity: "error",
        message: `Unknown node type: ${node.data.blockType}`,
      });
      continue;
    }
    if (block.category === "end") continue;
    const outs = graph.edges.filter((e) => e.source === node.id);
    if (!outs.length) {
      issues.push({
        layer,
        nodeId: node.id,
        severity: "error",
        message: `${node.data.label} has no outgoing path.`,
      });
    }
    if (isBranchingBlock(node.data.blockType) && block.branches === "yes_no") {
      const yes = outs.some((e) => (e.sourceHandle || "") === "yes");
      const no = outs.some((e) => (e.sourceHandle || "") === "no");
      if (!yes || !no) {
        issues.push({
          layer,
          nodeId: node.id,
          severity: "error",
          message: `${node.data.label} needs both Yes and No branches.`,
        });
      }
    }
  }

  if (hasCycle(graph)) {
    issues.push({
      layer,
      severity: "error",
      message: `${layer} flow contains a cycle without an exit — add an End call or break the loop.`,
    });
  }

  return issues;
}

function hasCycle(graph: VoiceFlowGraph): boolean {
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) adj.get(e.source)?.push(e.target);
  const visiting = new Set<string>();
  const done = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  for (const n of graph.nodes) {
    if (dfs(n.id)) return true;
  }
  return false;
}

export function hasBlockingFlowErrors(issues: FlowIssue[]) {
  return issues.some((i) => i.severity === "error");
}

export function collectToolKeysFromFlow(bundle: VoiceFlowBundle): string[] {
  const keys = new Set<string>();
  const walk = (nodes: VoiceFlowNode[]) => {
    for (const node of nodes) {
      const block = getVoiceFlowBlock(node.data.blockType);
      if (block?.toolKey) keys.add(block.toolKey);
      if (node.data.blockType === "tool_call" && node.data.config?.toolKey) {
        keys.add(String(node.data.config.toolKey));
      }
      if (node.data.blockType === "knowledge_lookup") {
        // retrieval is attached separately via KB links
      }
    }
  };
  walk(bundle.conversation.nodes);
  walk(bundle.routing.nodes);
  // Always allow hangup + escalate for global rules.
  // Do not force end_call + transfer — dual terminators / native warm transfer
  // caused live PSTN hangups when CRM or handoff tools ran.
  keys.add("hangup");
  keys.add("escalate_human");
  return [...keys];
}
