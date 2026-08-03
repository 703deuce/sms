/**
 * Opinionated flow templates — businesses edit these instead of starting blank.
 */

import {
  createEdgeId,
  createNodeId,
  type VoiceFlowBundle,
  type VoiceFlowGraph,
  type VoiceFlowNode,
  type VoiceGlobalRule,
} from "./types";
import { getVoiceFlowBlock } from "./catalog";

function n(
  blockType: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
  label?: string,
): VoiceFlowNode {
  const block = getVoiceFlowBlock(blockType);
  return {
    id: createNodeId(),
    type: block?.category || "conversation",
    position: { x, y },
    data: {
      blockType,
      label: label || block?.label || blockType,
      config: { ...(block?.defaultConfig || {}), ...config },
    },
  };
}

function e(
  source: VoiceFlowNode,
  target: VoiceFlowNode,
  handle: string = "default",
) {
  return {
    id: createEdgeId(),
    source: source.id,
    target: target.id,
    sourceHandle: handle,
    targetHandle: null as string | null,
  };
}

function graph(nodes: VoiceFlowNode[], edges: ReturnType<typeof e>[]): VoiceFlowGraph {
  return { version: 1, nodes, edges, viewport: { x: 0, y: 0, zoom: 0.85 } };
}

const DEFAULT_GLOBAL: VoiceGlobalRule[] = [
  {
    id: "gr_person",
    name: "Want a real person",
    trigger: "want_person",
    enabled: true,
    destinationBlockType: "escalate_human",
    transferTargetName: "Agent Handoff",
    instructions:
      "If the caller asks for a person, human, agent, or transfer, use escalate_human / Transfer to 'Agent Handoff'. Never invent a phone number.",
  },
  {
    id: "gr_stop",
    name: "Stop / end call",
    trigger: "stop",
    enabled: true,
    destinationBlockType: "end_call",
    instructions: "If the caller says stop or wants to end, give a short closing and hang up.",
  },
  {
    id: "gr_emergency",
    name: "Emergency",
    trigger: "emergency",
    enabled: true,
    destinationBlockType: "escalate_human",
    transferTargetName: "Agent Handoff",
    instructions:
      "If the caller indicates an emergency, escalate immediately to Agent Handoff without extra intake.",
  },
  {
    id: "gr_callback",
    name: "Call me back",
    trigger: "callback",
    enabled: true,
    destinationBlockType: "take_message",
    instructions: "Capture callback preference with take_structured_message and create a follow-up task.",
  },
  {
    id: "gr_toolfail",
    name: "Tool failure recovery",
    trigger: "tool_failure",
    enabled: true,
    destinationBlockType: "take_message",
    instructions:
      "If a CRM lookup, transfer, SMS, or other tool fails or times out, apologize, stay on the line, and offer to take a message. Never hang up because a tool failed.",
  },
];

function answeringConversation(): VoiceFlowGraph {
  const greeting = n("greeting", 80, 40);
  const intent = n("identify_intent", 80, 160);
  const knowledge = n("knowledge_lookup", 320, 160, {}, "Answer FAQ");
  const message = n("take_message", 80, 300);
  const sms = n("send_sms", 320, 300, { template: "callback_ack" });
  const note = n("create_crm_note", 80, 440);
  const end = n("end_call", 80, 580);
  const human = n("escalate_human", 520, 160);
  return graph(
    [greeting, intent, knowledge, message, sms, note, end, human],
    [
      e(greeting, intent),
      e(intent, knowledge, "faq"),
      e(intent, message, "other"),
      e(intent, human, "human"),
      e(knowledge, end),
      e(message, sms),
      e(sms, note),
      e(note, end),
      e(human, end),
    ],
  );
}

function leadIntakeConversation(): VoiceFlowGraph {
  const greeting = n("greeting", 80, 40, {
    text: "Thanks for calling. I can help qualify your request and get you scheduled.",
  });
  const existing = n("existing_customer", 80, 160);
  const crm = n("search_crm_contacts", 320, 160);
  const intake = n("structured_intake", 80, 300);
  const upsert = n("upsert_crm_contact", 80, 440);
  const sms = n("send_sms", 320, 440, { template: "booking_link" });
  const task = n("create_crm_task", 80, 580);
  const urgent = n("condition", 320, 580, { field: "urgency", equals: "high" }, "High urgency?");
  const transfer = n("escalate_human", 520, 580);
  const end = n("end_call", 80, 720);
  return graph(
    [greeting, existing, crm, intake, upsert, sms, task, urgent, transfer, end],
    [
      e(greeting, existing),
      e(existing, crm, "yes"),
      e(existing, intake, "no"),
      e(crm, intake, "yes"),
      e(crm, intake, "no"),
      e(intake, upsert),
      e(upsert, sms),
      e(sms, task),
      e(task, urgent),
      e(urgent, transfer, "yes"),
      e(urgent, end, "no"),
      e(transfer, end),
    ],
  );
}

function faqRouterConversation(): VoiceFlowGraph {
  const greeting = n("greeting", 80, 40);
  const intent = n("identify_intent", 80, 180);
  const knowledge = n("knowledge_lookup", 320, 80);
  const sales = n("transfer", 320, 180, { targetName: "Agent Handoff" }, "Transfer sales");
  const billing = n("agent_handoff", 520, 180, { assistantName: "Billing Specialist" });
  const appt = n("send_sms", 320, 300, { template: "booking_link" }, "Send booking link");
  const message = n("take_message", 80, 300);
  const end = n("end_call", 80, 440);
  return graph(
    [greeting, intent, knowledge, sales, billing, appt, message, end],
    [
      e(greeting, intent),
      e(intent, knowledge, "faq"),
      e(intent, sales, "sales"),
      e(intent, billing, "billing"),
      e(intent, appt, "appointment"),
      e(intent, message, "other"),
      e(intent, sales, "human"),
      e(knowledge, end),
      e(appt, end),
      e(message, end),
      e(sales, end),
      e(billing, end),
    ],
  );
}

function humanFirstRouting(): VoiceFlowGraph {
  const incoming = n("incoming_call", 80, 40);
  const hours = n("business_hours", 80, 160);
  const ring = n("ring_group", 80, 300, { seconds: 25 });
  const answered = n("human_answered", 80, 440);
  const connect = n(
    "end_call",
    320,
    440,
    {
      closing:
        "You're connected with our team. Thanks for calling — stay on the line.",
    },
    "Human connected",
  );
  const aiMissed = n("no_answer_ai", 80, 580);
  const afterHours = n("after_hours_ai", 320, 300);
  return graph(
    [incoming, hours, ring, answered, connect, aiMissed, afterHours],
    [
      e(incoming, hours),
      e(hours, ring, "yes"),
      e(hours, afterHours, "no"),
      e(ring, answered, "yes"),
      e(ring, aiMissed, "no"),
      e(answered, connect, "yes"),
      e(answered, aiMissed, "no"),
      // Terminal AI nodes intentionally have no further edges.
    ],
  );
}

function aiFirstRouting(): VoiceFlowGraph {
  const incoming = n("incoming_call", 80, 40);
  const hours = n("business_hours", 80, 160);
  const ai = n("ai_assistant", 80, 300);
  const after = n("after_hours_ai", 320, 300);
  return graph(
    [incoming, hours, ai, after],
    [e(incoming, hours), e(hours, ai, "yes"), e(hours, after, "no")],
  );
}

function afterHoursRouting(): VoiceFlowGraph {
  const incoming = n("incoming_call", 80, 40);
  const hours = n("business_hours", 80, 160);
  const ring = n("ring_group", 320, 160, { seconds: 20 });
  const ai = n("after_hours_ai", 80, 300);
  return graph(
    [incoming, hours, ring, ai],
    [e(incoming, hours), e(hours, ring, "yes"), e(hours, ai, "no"), e(ring, ai, "no")],
  );
}

export type VoiceFlowTemplateId =
  | "missed_call"
  | "after_hours"
  | "answering_machine"
  | "faq_router"
  | "lead_intake"
  | "quote_request"
  | "scheduling_link"
  | "appointment_request"
  | "support_triage"
  | "full_receptionist";

export type VoiceFlowTemplate = {
  id: VoiceFlowTemplateId;
  name: string;
  description: string;
  agentLevel: "answering" | "intake" | "receptionist" | "pro";
  bundle: VoiceFlowBundle;
};

export const VOICE_FLOW_TEMPLATES: VoiceFlowTemplate[] = [
  {
    id: "missed_call",
    name: "Missed-Call Assistant",
    description: "Ring humans first; AI answers if no one picks up.",
    agentLevel: "answering",
    bundle: {
      routing: humanFirstRouting(),
      conversation: answeringConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "after_hours",
    name: "After-Hours Assistant",
    description: "AI when closed; optional urgent transfer.",
    agentLevel: "answering",
    bundle: {
      routing: afterHoursRouting(),
      conversation: (() => {
        const g = n("greeting", 80, 40, {
          text: "Thanks for calling. Our office is currently closed. I can take a message or help with urgent requests.",
        });
        const urgent = n("condition", 80, 180, { field: "urgency", equals: "high" }, "Urgent?");
        const transfer = n("escalate_human", 320, 180);
        const message = n("take_message", 80, 320);
        const task = n("create_crm_task", 80, 460);
        const end = n("end_call", 80, 600);
        return graph(
          [g, urgent, transfer, message, task, end],
          [
            e(g, urgent),
            e(urgent, transfer, "yes"),
            e(urgent, message, "no"),
            e(message, task),
            e(task, end),
            e(transfer, end),
          ],
        );
      })(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "answering_machine",
    name: "AI Answering Machine",
    description: "AI answers, takes message, FAQ, optional SMS.",
    agentLevel: "answering",
    bundle: {
      routing: aiFirstRouting(),
      conversation: answeringConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "faq_router",
    name: "FAQ and Routing Assistant",
    description: "Answer FAQs and route sales/billing/appointments.",
    agentLevel: "receptionist",
    bundle: {
      routing: aiFirstRouting(),
      conversation: faqRouterConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "lead_intake",
    name: "New Lead Intake",
    description: "Qualify leads, save CRM contact, send booking link.",
    agentLevel: "intake",
    bundle: {
      routing: aiFirstRouting(),
      conversation: leadIntakeConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "quote_request",
    name: "Quote Request Intake",
    description: "Collect quote details and create a CRM task.",
    agentLevel: "intake",
    bundle: {
      routing: aiFirstRouting(),
      conversation: leadIntakeConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "scheduling_link",
    name: "Scheduling-Link Sender",
    description: "Collect need and text an approved booking link.",
    agentLevel: "intake",
    bundle: {
      routing: aiFirstRouting(),
      conversation: (() => {
        const g = n("greeting", 80, 40);
        const ask = n("ask_question", 80, 160, {
          question: "What service do you need?",
          variable: "service",
        });
        const sms = n("send_sms", 80, 300, { template: "booking_link" });
        const end = n("end_call", 80, 440);
        return graph([g, ask, sms, end], [e(g, ask), e(ask, sms), e(sms, end)]);
      })(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "appointment_request",
    name: "Appointment Request Assistant",
    description: "Collect preferred time, book or send link, transfer or take a message.",
    agentLevel: "intake",
    bundle: {
      routing: aiFirstRouting(),
      conversation: (() => {
        const g = n("greeting", 80, 40);
        const intake = n("structured_intake", 80, 160, {
          fields: ["name", "service", "preferred_time", "callback"],
        });
        const sms = n("send_sms", 80, 300, { template: "booking_link" });
        const task = n("create_crm_task", 80, 440);
        const message = n("take_message", 320, 440);
        const human = n("escalate_human", 520, 300);
        const end = n("end_call", 80, 580);
        return graph(
          [g, intake, sms, task, message, human, end],
          [
            e(g, intake),
            e(intake, sms),
            e(sms, task),
            e(task, end),
            e(intake, message, "message"),
            e(intake, human, "human"),
            e(message, end),
            e(human, end),
          ],
        );
      })(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "support_triage",
    name: "Customer Support Triage",
    description: "Identify issue, FAQ, escalate or hand off to billing AI.",
    agentLevel: "receptionist",
    bundle: {
      routing: aiFirstRouting(),
      conversation: faqRouterConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
  {
    id: "full_receptionist",
    name: "Full AI Receptionist",
    description: "Human-first ring, AI fallback, CRM, transfers, intake.",
    agentLevel: "receptionist",
    bundle: {
      routing: humanFirstRouting(),
      conversation: faqRouterConversation(),
      globalRules: DEFAULT_GLOBAL,
    },
  },
];

export function getVoiceFlowTemplate(id: string): VoiceFlowTemplate | undefined {
  return VOICE_FLOW_TEMPLATES.find((t) => t.id === id);
}

export function defaultFlowBundleForAgentType(agentType?: string | null): VoiceFlowBundle {
  switch (agentType) {
    case "lead_qualification":
    case "sales":
      return structuredClone(getVoiceFlowTemplate("lead_intake")!.bundle);
    case "appointment_booking":
      return structuredClone(getVoiceFlowTemplate("appointment_request")!.bundle);
    case "customer_support":
      return structuredClone(getVoiceFlowTemplate("support_triage")!.bundle);
    case "receptionist":
      return structuredClone(getVoiceFlowTemplate("full_receptionist")!.bundle);
    default:
      return structuredClone(getVoiceFlowTemplate("answering_machine")!.bundle);
  }
}
