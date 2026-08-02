/**
 * Node catalog for the visual AI call-flow builder.
 */

import type { VoiceFlowNodeCategory } from "./types";

export type VoiceFlowBlock = {
  blockType: string;
  category: VoiceFlowNodeCategory;
  layer: "routing" | "conversation" | "both";
  label: string;
  description: string;
  defaultConfig?: Record<string, unknown>;
  /** Condition-style yes/no handles */
  branches?: "yes_no" | "intent" | "none";
  /** Maps to builtin / native tool key when compiled */
  toolKey?: string;
};

export const VOICE_FLOW_BLOCKS: VoiceFlowBlock[] = [
  // —— Call Routing ——
  {
    blockType: "incoming_call",
    category: "entry",
    layer: "routing",
    label: "Incoming call",
    description: "Entry point for an inbound phone call",
    branches: "none",
  },
  {
    blockType: "business_hours",
    category: "logic",
    layer: "both",
    label: "Business hours?",
    description: "Branch by open / closed hours",
    branches: "yes_no",
  },
  {
    blockType: "ivr_menu",
    category: "routing",
    layer: "routing",
    label: "IVR / menu",
    description: "Play a menu and collect DTMF",
    defaultConfig: { prompt: "Press 1 for sales, 2 for support." },
    branches: "intent",
  },
  {
    blockType: "ring_group",
    category: "routing",
    layer: "routing",
    label: "Ring team",
    description: "Ring humans for a limited time (Sona-style)",
    defaultConfig: { seconds: 25, strategy: "simultaneous" },
    branches: "yes_no",
  },
  {
    blockType: "ring_user",
    category: "routing",
    layer: "routing",
    label: "Ring user",
    description: "Ring a specific teammate",
    defaultConfig: { seconds: 20 },
    branches: "yes_no",
  },
  {
    blockType: "queue",
    category: "routing",
    layer: "routing",
    label: "Queue",
    description: "Place the caller in a call queue",
    branches: "yes_no",
  },
  {
    blockType: "forward_call",
    category: "routing",
    layer: "routing",
    label: "Forward call",
    description: "Forward to an external number",
    defaultConfig: { destination: "" },
    branches: "yes_no",
  },
  {
    blockType: "human_answered",
    category: "logic",
    layer: "routing",
    label: "Human answered?",
    description: "Branch after a ring attempt",
    branches: "yes_no",
  },
  {
    blockType: "voicemail",
    category: "routing",
    layer: "routing",
    label: "Voicemail",
    description: "Standard voicemail box",
    branches: "none",
  },
  {
    blockType: "ai_assistant",
    category: "routing",
    layer: "routing",
    label: "AI assistant",
    description: "Hand the call to an AI agent conversation flow",
    defaultConfig: { mode: "conversation" },
    branches: "none",
  },
  {
    blockType: "no_answer_ai",
    category: "routing",
    layer: "routing",
    label: "AI on no answer",
    description: "Missed-call AI answering machine",
    branches: "none",
  },
  {
    blockType: "after_hours_ai",
    category: "routing",
    layer: "routing",
    label: "After-hours AI",
    description: "AI when the office is closed",
    branches: "none",
  },

  // —— AI Conversation ——
  {
    blockType: "greeting",
    category: "conversation",
    layer: "conversation",
    label: "Greeting",
    description: "Speak the opening greeting once",
    defaultConfig: {
      text: "Thank you for calling. I'm the virtual assistant. How can I help you today?",
    },
    branches: "none",
  },
  {
    blockType: "conversation",
    category: "conversation",
    layer: "conversation",
    label: "Conversation",
    description: "Multi-turn dialogue until an intent or condition is met",
    defaultConfig: { goal: "Understand why the caller is calling" },
    branches: "none",
  },
  {
    blockType: "ask_question",
    category: "conversation",
    layer: "conversation",
    label: "Ask question",
    description: "Ask one structured question and capture a variable",
    defaultConfig: { question: "", variable: "answer" },
    branches: "none",
  },
  {
    blockType: "structured_intake",
    category: "conversation",
    layer: "conversation",
    label: "Lead intake",
    description: "Collect name, service, location, urgency",
    defaultConfig: {
      fields: ["name", "service", "location", "urgency", "callback"],
    },
    branches: "none",
  },
  {
    blockType: "identify_intent",
    category: "logic",
    layer: "conversation",
    label: "Identify intent",
    description: "Switch by caller intent",
    branches: "intent",
    defaultConfig: {
      intents: ["faq", "sales", "billing", "appointment", "human", "other"],
    },
  },
  {
    blockType: "existing_customer",
    category: "logic",
    layer: "conversation",
    label: "Existing customer?",
    description: "Branch if CRM/local contact is found",
    branches: "yes_no",
  },
  {
    blockType: "condition",
    category: "logic",
    layer: "both",
    label: "Condition",
    description: "Generic if / else branch",
    branches: "yes_no",
    defaultConfig: { field: "", equals: "" },
  },
  {
    blockType: "knowledge_lookup",
    category: "tools",
    layer: "conversation",
    label: "Knowledge lookup",
    description: "Answer from the attached knowledge base",
    branches: "none",
  },
  {
    blockType: "wait_filler",
    category: "conversation",
    layer: "conversation",
    label: "Wait / filler",
    description: "Speak a short filler while a tool runs",
    defaultConfig: { text: "One moment while I look that up." },
    branches: "none",
  },
  {
    blockType: "confirmation",
    category: "conversation",
    layer: "conversation",
    label: "Confirm with caller",
    description: "Require explicit confirmation before a write action",
    branches: "yes_no",
  },

  // —— Tools / CRM / Messaging ——
  {
    blockType: "search_crm_contacts",
    category: "crm",
    layer: "conversation",
    label: "CRM lookup",
    description: "Search contacts via Transovo CRM adapters",
    toolKey: "search_crm_contacts",
    branches: "yes_no",
  },
  {
    blockType: "create_crm_note",
    category: "crm",
    layer: "conversation",
    label: "Create CRM note",
    description: "Save a note on the matched CRM contact",
    toolKey: "create_crm_note",
    branches: "none",
  },
  {
    blockType: "create_crm_task",
    category: "crm",
    layer: "conversation",
    label: "Create CRM task",
    description: "Create a follow-up task in CRM",
    toolKey: "create_crm_task",
    branches: "none",
  },
  {
    blockType: "upsert_crm_contact",
    category: "crm",
    layer: "conversation",
    label: "Save CRM contact",
    description: "Create or update the CRM contact",
    toolKey: "upsert_crm_contact",
    branches: "none",
  },
  {
    blockType: "send_sms",
    category: "messaging",
    layer: "conversation",
    label: "Send SMS",
    description: "Send an approved SMS or booking link",
    toolKey: "send_sms",
    defaultConfig: { template: "booking_link" },
    branches: "none",
  },
  {
    blockType: "take_message",
    category: "messaging",
    layer: "conversation",
    label: "Take message",
    description: "Capture a structured message for the team",
    toolKey: "take_structured_message",
    branches: "none",
  },
  {
    blockType: "set_disposition",
    category: "tools",
    layer: "conversation",
    label: "Set disposition",
    description: "Mark the call outcome",
    toolKey: "mark_disposition",
    branches: "none",
  },
  {
    blockType: "tool_call",
    category: "tools",
    layer: "conversation",
    label: "Tool call",
    description: "Invoke an enabled agent tool",
    defaultConfig: { toolKey: "" },
    branches: "yes_no",
  },

  // —— Handoff / End ——
  {
    blockType: "transfer",
    category: "handoff",
    layer: "both",
    label: "Transfer",
    description: "Transfer to a named destination (never invent numbers)",
    toolKey: "transfer",
    defaultConfig: { targetName: "Agent Handoff" },
    branches: "yes_no",
  },
  {
    blockType: "agent_handoff",
    category: "handoff",
    layer: "conversation",
    label: "AI agent handoff",
    description: "Hand off to another specialized AI assistant",
    toolKey: "handoff",
    defaultConfig: { assistantName: "Billing Specialist" },
    branches: "none",
  },
  {
    blockType: "escalate_human",
    category: "handoff",
    layer: "conversation",
    label: "Escalate to human",
    description: "Warm transfer via Agent Handoff destination",
    toolKey: "escalate_human",
    defaultConfig: { targetName: "Agent Handoff" },
    branches: "yes_no",
  },
  {
    blockType: "end_call",
    category: "end",
    layer: "both",
    label: "End call",
    description: "Closing statement then hang up",
    toolKey: "hangup",
    defaultConfig: {
      closing: "Thanks for calling. Goodbye.",
    },
    branches: "none",
  },
];

const BY_TYPE = new Map(VOICE_FLOW_BLOCKS.map((b) => [b.blockType, b]));

export function getVoiceFlowBlock(blockType: string): VoiceFlowBlock | undefined {
  return BY_TYPE.get(blockType);
}

export function blocksForLayer(layer: "routing" | "conversation"): VoiceFlowBlock[] {
  return VOICE_FLOW_BLOCKS.filter((b) => b.layer === layer || b.layer === "both");
}

export function isBranchingBlock(blockType: string): boolean {
  const b = BY_TYPE.get(blockType);
  return b?.branches === "yes_no" || b?.branches === "intent";
}

export const SIDEBAR_GROUPS: Array<{
  id: string;
  label: string;
  categories: VoiceFlowNodeCategory[];
}> = [
  { id: "routing", label: "Call Routing", categories: ["entry", "routing"] },
  { id: "conversation", label: "AI Conversation", categories: ["conversation"] },
  { id: "logic", label: "Logic", categories: ["logic"] },
  { id: "tools", label: "Tools", categories: ["tools"] },
  { id: "crm", label: "CRM", categories: ["crm"] },
  { id: "messaging", label: "Messaging", categories: ["messaging"] },
  { id: "handoff", label: "Human Handoff", categories: ["handoff"] },
  { id: "end", label: "Endpoints", categories: ["end"] },
];
