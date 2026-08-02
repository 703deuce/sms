/**
 * Compile visual VoiceFlow graphs into:
 * - VoiceAgentConfig patches (instructions, greeting, tools, conversationFlow sections)
 * - VoiceRoutingRule actions (human_first / ai_answer / after_hours)
 *
 * Transovo remains source of truth; Telnyx receives synchronized assistant config.
 */

import type { VoiceAgentConfig } from "../types";
import { getVoiceFlowBlock } from "./catalog";
import { collectToolKeysFromFlow } from "./validation";
import type { VoiceFlowBundle, VoiceFlowNode, VoiceGlobalRule } from "./types";

export type CompiledVoiceFlow = {
  configPatch: Partial<VoiceAgentConfig>;
  enabledBuiltinTools: string[];
  routingMode: "ai_answer" | "human_first" | "ai_after_hours";
  humanFirstSeconds: number;
  transferTargets: Array<{ name: string; to?: string }>;
  flowInstructions: string;
  globalInstructions: string;
};

export function compileVoiceFlowBundle(
  bundle: VoiceFlowBundle,
  opts?: { preserveTools?: string[] },
): CompiledVoiceFlow {
  const tools = collectToolKeysFromFlow(bundle);
  // Ensure CRM search when CRM nodes present
  if (bundle.conversation.nodes.some((n) => n.data.blockType.startsWith("create_crm") || n.data.blockType.includes("crm") || n.data.blockType === "search_crm_contacts")) {
    tools.push("lookup_customer", "search_crm_contacts", "create_crm_note", "create_crm_task", "upsert_crm_contact");
  }
  if (bundle.conversation.nodes.some((n) => n.data.blockType === "send_sms")) {
    tools.push("send_sms");
  }
  if (bundle.conversation.nodes.some((n) => n.data.blockType === "take_message")) {
    tools.push("take_structured_message", "create_task", "mark_disposition", "save_caller_info");
  }
  if (bundle.conversation.nodes.some((n) => n.data.blockType === "agent_handoff")) {
    tools.push("handoff");
  }
  // Keep previously enabled tools (e.g. full receptionist catalog) unless empty.
  for (const t of opts?.preserveTools || []) tools.push(t);

  const greetingNode = bundle.conversation.nodes.find((n) => n.data.blockType === "greeting");
  const greetingText =
    String(greetingNode?.data.config?.text || "").trim() ||
    "Thank you for calling. I'm the virtual assistant. How can I help you today?";

  const endNode = bundle.conversation.nodes.find((n) => n.data.blockType === "end_call");
  const closing = String(endNode?.data.config?.closing || "Thanks for calling. Goodbye.");

  const sections = conversationSectionsFromGraph(bundle);
  const flowInstructions = buildConversationInstructions(bundle);
  const globalInstructions = buildGlobalInstructions(bundle.globalRules);

  const routing = detectRoutingMode(bundle);
  const transferTargets = collectTransferTargets(bundle);

  const enabledBuiltinTools = [...new Set(tools)];

  const configPatch: Partial<VoiceAgentConfig> = {
    callHandling: {
      greeting: greetingText,
      startupGreeting: {
        enabled: true,
        mode: "ai",
        text: "",
        delayMs: "auto",
        handOffWhenReady: true,
      },
      closingStatement: closing,
    },
    conversationFlow: { sections },
    enabledBuiltinTools,
    flows: bundle as unknown as Record<string, unknown>,
    instructions: {
      system: [
        "You are a voice AI agent following the published Transovo conversation flow.",
        "Never invent phone numbers, appointment times, or CRM values.",
        "Never claim a tool action succeeded until the tool returns success.",
        "If a tool is slow, say a short filler like 'One moment while I look that up.'",
        flowInstructions,
        globalInstructions,
      ]
        .filter(Boolean)
        .join("\n\n"),
      confirmation: "Confirm important details before transfers, SMS, or CRM writes.",
      escalation:
        "If the caller asks for a person, use Transfer / escalate_human to the named target Agent Handoff.",
      uncertainty: "If unsure, ask a clarifying question or offer to take a message.",
      fillerMessages: [
        "One moment while I look that up.",
        "Let me check that for you.",
      ],
    },
    transfers: {
      targets: transferTargets.map((t) => ({
        name: t.name,
        to: (t as { name: string; to?: string }).to || "",
      })),
      warmTransferInstructions:
        "Briefly introduce the caller and summarize why they are calling before connecting.",
    },
  };

  return {
    configPatch,
    enabledBuiltinTools,
    routingMode: routing.mode,
    humanFirstSeconds: routing.seconds,
    transferTargets,
    flowInstructions,
    globalInstructions,
  };
}

function detectRoutingMode(bundle: VoiceFlowBundle): {
  mode: CompiledVoiceFlow["routingMode"];
  seconds: number;
} {
  const hasRing = bundle.routing.nodes.some((n) =>
    ["ring_group", "ring_user", "queue"].includes(n.data.blockType),
  );
  const ring = bundle.routing.nodes.find((n) => n.data.blockType === "ring_group");
  const seconds = Number(ring?.data.config?.seconds || 25);
  const hasAfterHours = bundle.routing.nodes.some(
    (n) => n.data.blockType === "after_hours_ai",
  );
  const hasNoAnswerAi = bundle.routing.nodes.some(
    (n) => n.data.blockType === "no_answer_ai",
  );
  if (hasRing && (hasNoAnswerAi || hasAfterHours)) {
    return { mode: "human_first", seconds };
  }
  if (hasAfterHours && !hasRing) {
    return { mode: "ai_after_hours", seconds };
  }
  return { mode: "ai_answer", seconds };
}

function collectTransferTargets(bundle: VoiceFlowBundle) {
  const names = new Set<string>();
  for (const node of [...bundle.routing.nodes, ...bundle.conversation.nodes]) {
    if (
      node.data.blockType === "transfer" ||
      node.data.blockType === "escalate_human"
    ) {
      const name = String(node.data.config?.targetName || "Agent Handoff").trim();
      if (name) names.add(name);
    }
  }
  for (const rule of bundle.globalRules) {
    if (rule.transferTargetName) names.add(rule.transferTargetName);
  }
  names.add("Agent Handoff");
  names.add("Front Desk");
  return [...names].map((name) => ({ name, to: undefined as string | undefined }));
}

function conversationSectionsFromGraph(bundle: VoiceFlowBundle) {
  const order = [
    "greeting",
    "conversation",
    "identify_intent",
    "structured_intake",
    "ask_question",
    "knowledge_lookup",
    "search_crm_contacts",
    "send_sms",
    "take_message",
    "transfer",
    "escalate_human",
    "end_call",
  ];
  const present = new Set(bundle.conversation.nodes.map((n) => n.data.blockType));
  const sections = order
    .filter((t) => present.has(t))
    .map((type) => {
      const node = bundle.conversation.nodes.find((n) => n.data.blockType === type);
      return {
        id: node?.id || type,
        type: mapSectionType(type),
        label: node?.data.label || type,
        enabled: true,
        config: node?.data.config || {},
      };
    });
  // Ensure core sections exist for builder compatibility
  const ensure = (
    type: string,
    label: string,
    enabled: boolean,
  ) => {
    if (!sections.some((s) => s.type === type)) {
      sections.push({ id: type, type, label, enabled, config: {} });
    }
  };
  ensure("greeting", "Greeting", true);
  ensure("intent", "Intent detection", present.has("identify_intent"));
  ensure("qualification", "Qualification", present.has("structured_intake"));
  ensure("transfer", "Transfer", present.has("transfer") || present.has("escalate_human"));
  ensure("message_taking", "Message taking", present.has("take_message"));
  ensure("ending", "End call", true);
  return sections;
}

function mapSectionType(blockType: string): string {
  switch (blockType) {
    case "identify_intent":
      return "intent";
    case "structured_intake":
      return "qualification";
    case "take_message":
      return "message_taking";
    case "end_call":
      return "ending";
    case "send_sms":
      return "sms_followup";
    case "search_crm_contacts":
      return "identify_caller";
    default:
      return blockType;
  }
}

function buildConversationInstructions(bundle: VoiceFlowBundle): string {
  const steps = topologicalRough(bundle.conversation.nodes, bundle.conversation.edges);
  const lines = [
    "Follow this conversation flow in order, adapting naturally to the caller:",
  ];
  let i = 1;
  for (const node of steps) {
    const block = getVoiceFlowBlock(node.data.blockType);
    lines.push(`${i}. ${node.data.label} (${node.data.blockType}): ${describeNode(node, block?.description || "")}`);
    i += 1;
  }
  return lines.join("\n");
}

function describeNode(node: VoiceFlowNode, fallback: string): string {
  const c = node.data.config || {};
  switch (node.data.blockType) {
    case "greeting":
      return `Say exactly once: "${String(c.text || "").slice(0, 160)}"`;
    case "ask_question":
      return `Ask: "${c.question}" and store as ${c.variable || "answer"}.`;
    case "transfer":
    case "escalate_human":
      return `Transfer to named target "${c.targetName || "Agent Handoff"}" using the Transfer tool.`;
    case "send_sms":
      return `Send an approved SMS (${c.template || "link"}) only after confirming the phone number.`;
    case "take_message":
      return "Capture a structured message (name, phone, reason, urgency) via take_structured_message.";
    case "search_crm_contacts":
      return "Look up the caller/contact. Do not disclose another person's phone on public inbound calls.";
    case "end_call":
      return `Close with: "${c.closing || "Thanks for calling. Goodbye."}" then hang up.`;
    default:
      return fallback || node.data.blockType;
  }
}

function buildGlobalInstructions(rules: VoiceGlobalRule[]): string {
  const enabled = rules.filter((r) => r.enabled);
  if (!enabled.length) return "";
  const lines = ["Global rules (apply from any point in the call):"];
  for (const r of enabled) {
    lines.push(
      `- ${r.name} [${r.trigger}]: ${r.instructions || `Route via ${r.destinationBlockType || "transfer"}`}${
        r.transferTargetName ? ` → ${r.transferTargetName}` : ""
      }`,
    );
  }
  return lines.join("\n");
}

function topologicalRough(
  nodes: VoiceFlowNode[],
  edges: Array<{ source: string; target: string }>,
): VoiceFlowNode[] {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0);
  const out: VoiceFlowNode[] = [];
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.source)?.push(e.target);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const t of adj.get(n.id) || []) {
      indeg.set(t, (indeg.get(t) || 0) - 1);
      if ((indeg.get(t) || 0) === 0) {
        const node = byId.get(t);
        if (node) queue.push(node);
      }
    }
  }
  // Append any leftover (cycles) in original order
  for (const n of nodes) {
    if (!out.some((o) => o.id === n.id)) out.push(n);
  }
  return out;
}

/**
 * Upsert workspace VoiceRoutingRule rows from a compiled flow for an agent.
 */
export async function syncRoutingRulesFromFlow(input: {
  workspaceId: string;
  agentId: string;
  compiled: CompiledVoiceFlow;
}) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  // Soft-replace agent-scoped rules tagged as flow-managed.
  const existing = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId: input.workspaceId, agentId: input.agentId },
  });
  for (const rule of existing) {
    const meta = (rule.conditions || {}) as Record<string, unknown>;
    if (meta.flowManaged) {
      await prisma.voiceRoutingRule.delete({ where: { id: rule.id } });
    }
  }

  if (input.compiled.routingMode === "human_first") {
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        name: "Flow: human first then AI",
        priority: 10,
        isActive: true,
        conditions: {
          flowManaged: true,
          businessHoursOnly: true,
        },
        actions: {
          type: "human_first",
          agentId: input.agentId,
          ringSeconds: input.compiled.humanFirstSeconds,
          fallback: "ai_answer",
        },
      },
    });
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        name: "Flow: after-hours AI",
        priority: 20,
        isActive: true,
        conditions: {
          flowManaged: true,
          afterHoursOnly: true,
        },
        actions: {
          type: "ai_after_hours",
          agentId: input.agentId,
        },
      },
    });
  } else if (input.compiled.routingMode === "ai_after_hours") {
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        name: "Flow: AI after hours",
        priority: 10,
        isActive: true,
        conditions: { flowManaged: true, afterHoursOnly: true },
        actions: { type: "ai_after_hours", agentId: input.agentId },
      },
    });
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        name: "Flow: AI answer",
        priority: 20,
        isActive: true,
        conditions: { flowManaged: true },
        actions: { type: "ai_answer", agentId: input.agentId },
      },
    });
  } else {
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        name: "Flow: AI answer",
        priority: 10,
        isActive: true,
        conditions: { flowManaged: true },
        actions: { type: "ai_answer", agentId: input.agentId },
      },
    });
  }
}
