/**
 * MCTB Workflow Architect — builds/modifies John's workflow using registered nodes.
 * Uses the shared Transovo node catalog; John does NOT build his own workflow.
 */

import { WORKFLOW_NODE_CATALOG, isRegisteredNodeType } from "@/lib/platform/workflow-dsl/node-catalog";
import { buildMissedCallTextBackDefinition } from "@/lib/solutions/missed-call-text-back/graph";
import type { MissedCallTextBackConfig } from "@/lib/solutions/missed-call-text-back/types";
import { llmChatWithTools, type LlmChatMessage, type LlmToolDefinition } from "@/lib/ai/llm-tools";
import {
  hasMctbArchitectLlmConfigured,
  resolveJohnLlmProviders,
} from "./model-config";

export const MCTB_NODE_CATALOG = [
  ...WORKFLOW_NODE_CATALOG,
  // MCTB-specific nodes (workflow/runtime nodes — NOT John LLM tools)
  {
    type: "evaluate_missed_call",
    category: "trigger",
    label: "Evaluate missed call eligibility",
  },
  { type: "schedule_text", category: "messaging", label: "Schedule MCTB text" },
  { type: "cancel_pending_text", category: "messaging", label: "Cancel pending text" },
  { type: "check_cooldown", category: "condition", label: "Check cooldown" },
  { type: "check_opt_out", category: "condition", label: "Check opt-out" },
  { type: "wait_for_reply", category: "messaging", label: "Wait for SMS reply" },
  { type: "john_llm_conversation", category: "messaging", label: "John LLM conversation turn" },
  { type: "request_callback", category: "escalation", label: "Request callback" },
  { type: "escalate_human", category: "escalation", label: "Escalate to human" },
] as const;

export type MctbWorkflowDraft = {
  workflow_id: string;
  version: number;
  nodes: Array<{ id: string; type: string; config?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string; condition?: string }>;
  initial_message?: string;
  delay_seconds?: number;
};

const BUILD_DRAFT_TOOL: LlmToolDefinition = {
  type: "function",
  function: {
    name: "build_mctb_workflow_draft",
    description: "Build a candidate MCTB workflow using only registered node types.",
    parameters: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              config: { type: "object" },
            },
            required: ["id", "type"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              condition: { type: "string" },
            },
            required: ["from", "to"],
          },
        },
        delay_seconds: { type: "number" },
        initial_message: { type: "string" },
      },
      required: ["nodes", "edges"],
    },
  },
};

export function buildDefaultMctbWorkflowDraft(config?: {
  delay_seconds?: number;
  initial_message?: string;
}): MctbWorkflowDraft {
  return {
    workflow_id: "mctb_default",
    version: 1,
    delay_seconds: config?.delay_seconds ?? 0,
    initial_message: config?.initial_message ?? "Hi, sorry we missed your call. How can we help?",
    nodes: [
      { id: "n1", type: "missed_call" },
      { id: "n2", type: "evaluate_missed_call" },
      { id: "n3", type: "if", config: { expression: "eligible" } },
      { id: "n4", type: "wait", config: { delay_seconds: config?.delay_seconds ?? 0 } },
      { id: "n5", type: "check_opt_out" },
      { id: "n6", type: "send_sms", config: { body: config?.initial_message } },
      { id: "n7", type: "wait_for_reply" },
      { id: "n8", type: "john_llm_conversation" },
      { id: "n9", type: "end" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", condition: "yes" },
      { from: "n3", to: "n9", condition: "no" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "n8" },
      { from: "n8", to: "n9" },
    ],
  };
}

export function validateMctbWorkflowDraft(draft: MctbWorkflowDraft): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(draft.nodes.map((n) => n.id));

  for (const node of draft.nodes) {
    if (!isRegisteredNodeType(node.type) && !MCTB_NODE_CATALOG.some((n) => n.type === node.type)) {
      errors.push(`Unregistered node type: ${node.type}`);
    }
  }

  for (const edge of draft.edges) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge from unknown node: ${edge.from}`);
    if (!nodeIds.has(edge.to)) errors.push(`Edge to unknown node: ${edge.to}`);
  }

  const reachable = new Set<string>();
  const start = draft.nodes[0]?.id;
  if (start) {
    const queue = [start];
    while (queue.length) {
      const cur = queue.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      for (const e of draft.edges.filter((x) => x.from === cur)) {
        queue.push(e.to);
      }
    }
  }
  const endNode = draft.nodes.find((n) => n.type === "end");
  if (endNode && !reachable.has(endNode.id)) {
    errors.push("End node not reachable from trigger");
  }

  if (!draft.nodes.some((n) => n.type === "check_opt_out" || n.type === "evaluate_missed_call")) {
    errors.push("Missing opt-out or eligibility handling");
  }

  return { valid: errors.length === 0, errors };
}

export function compileMctbWorkflowToLegacyGraph(
  config: MissedCallTextBackConfig,
): ReturnType<typeof buildMissedCallTextBackDefinition> {
  return buildMissedCallTextBackDefinition(config);
}

export async function architectMctbWorkflowFromRequest(
  ownerRequest: string,
  currentConfig?: { delay_seconds?: number; initial_message?: string },
): Promise<{
  draft: MctbWorkflowDraft;
  modelInvoked: boolean;
  validation: ReturnType<typeof validateMctbWorkflowDraft>;
}> {
  const fallback = buildDefaultMctbWorkflowDraft(currentConfig);

  if (!hasMctbArchitectLlmConfigured()) {
    return {
      draft: fallback,
      modelInvoked: false,
      validation: validateMctbWorkflowDraft(fallback),
    };
  }

  const nodeList = MCTB_NODE_CATALOG.map((n) => n.type).join(", ");
  const messages: LlmChatMessage[] = [
    {
      role: "system",
      content: `You are the MCTB Workflow Architect for John (missed-call text-back).
Build workflows using ONLY these registered node types: ${nodeList}.
John LLM handles natural language; workflow nodes handle timing, eligibility, SMS, opt-out.
Use build_mctb_workflow_draft tool.`,
    },
    { role: "user", content: ownerRequest },
  ];

  const result = await llmChatWithTools(messages, [BUILD_DRAFT_TOOL], {
    temperature: 0.15,
    maxTokens: 2000,
    providerChain: resolveJohnLlmProviders("mctb_workflow_architect"),
  });

  if (result?.message.tool_calls?.length) {
    try {
      const args = JSON.parse(result.message.tool_calls[0].function.arguments || "{}");
      const draft: MctbWorkflowDraft = {
        workflow_id: "mctb_custom",
        version: 1,
        nodes: args.nodes || fallback.nodes,
        edges: args.edges || fallback.edges,
        delay_seconds: args.delay_seconds ?? currentConfig?.delay_seconds,
        initial_message: args.initial_message ?? currentConfig?.initial_message,
      };
      return {
        draft,
        modelInvoked: true,
        validation: validateMctbWorkflowDraft(draft),
      };
    } catch {
      // fall through
    }
  }

  return {
    draft: fallback,
    modelInvoked: Boolean(result),
    validation: validateMctbWorkflowDraft(fallback),
  };
}

export function buildMctbArchitectSystemPrompt(): string {
  return `MCTB Workflow Architect — creates John missed-call-text-back workflows.
Use registered nodes only. John executes conversations; architect builds the flow.`;
}
