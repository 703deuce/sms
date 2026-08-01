import type { VoiceAgentType, VoiceAgentConfig } from "./types";
import { DEFAULT_VOICE_CONFIG } from "./types";

export type AgentTemplate = {
  id: string;
  name: string;
  agentType: VoiceAgentType;
  description: string;
  config: Partial<VoiceAgentConfig>;
};

export const VOICE_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "receptionist",
    name: "Receptionist",
    agentType: "receptionist",
    description: "Answer calls, route callers, and take messages.",
    config: {
      identity: { directions: ["inbound", "outbound"] },
      instructions: {
        system:
          "You are the receptionist for the business. Greet callers warmly, identify their needs, and route or take a message. Never claim a transfer succeeded until the system confirms.",
        goals: "Answer professionally, capture caller intent, route or message.",
        tone: "warm",
        style: "professional",
      },
      conversationFlow: {
        sections: [
          { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
          { id: "intent", type: "intent", label: "Intent detection", enabled: true },
          { id: "transfer", type: "transfer", label: "Transfer", enabled: true },
          { id: "message", type: "message_taking", label: "Message taking", enabled: true },
          { id: "end", type: "ending", label: "End call", enabled: true },
        ],
      },
    },
  },
  {
    id: "lead_qualification",
    name: "Lead qualification",
    agentType: "lead_qualification",
    description: "Qualify inbound and outbound leads with scoring.",
    config: {
      identity: { directions: ["inbound", "outbound"] },
      instructions: {
        system:
          "Qualify leads by asking about service need, timeline, budget, and location. Score leads based on responses. Book appointments only after availability is confirmed.",
        goals: "Determine fit, urgency, and book qualified appointments.",
        tone: "consultative",
      },
      conversationFlow: {
        sections: [
          { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
          { id: "qualify", type: "qualification", label: "Qualification questions", enabled: true },
          { id: "booking", type: "booking", label: "Booking", enabled: true },
          { id: "end", type: "ending", label: "End call", enabled: true },
        ],
      },
    },
  },
  {
    id: "appointment_booking",
    name: "Appointment booking",
    agentType: "appointment_booking",
    description: "Check availability and book appointments live.",
    config: {
      identity: { directions: ["inbound", "outbound"] },
      instructions: {
        system:
          "Help callers book appointments. Always check live availability before offering times. Only confirm booking after the system returns success.",
        tone: "helpful",
      },
      conversationFlow: {
        sections: [
          { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
          { id: "booking", type: "booking", label: "Booking", enabled: true },
          { id: "sms", type: "sms_followup", label: "SMS confirmation", enabled: true },
          { id: "end", type: "ending", label: "End call", enabled: true },
        ],
      },
    },
  },
  {
    id: "customer_support",
    name: "Customer support",
    agentType: "customer_support",
    description: "Answer support FAQs, look up accounts, and escalate.",
    config: {
      identity: { directions: ["inbound"] },
      instructions: {
        system:
          "You are a support specialist. Use the knowledge retrieval tool for policies and FAQs. Look up the customer when possible. Escalate complex issues to a human.",
        goals: "Resolve issues accurately; escalate when needed.",
        tone: "empathetic",
        style: "clear",
      },
      conversationFlow: {
        sections: [
          { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
          { id: "identify", type: "identify_caller", label: "Identify caller", enabled: true },
          { id: "intent", type: "intent", label: "Issue intake", enabled: true },
          { id: "transfer", type: "transfer", label: "Escalate", enabled: true },
          { id: "end", type: "ending", label: "End call", enabled: true },
        ],
      },
    },
  },
  {
    id: "outbound_follow_up",
    name: "Outbound follow-up",
    agentType: "outbound_follow_up",
    description: "Follow up on leads and quotes.",
    config: {
      identity: { directions: ["outbound"] },
      instructions: {
        system:
          "You are calling to follow up on a prior inquiry. Be brief, respectful of time, and comply with calling regulations. Offer next steps or book a time.",
        tone: "friendly",
      },
      voicemail: { action: "leave_personalized" },
    },
  },
  {
    id: "reminders",
    name: "Reminders / collections",
    agentType: "collections",
    description: "Appointment reminders and gentle payment follow-ups.",
    config: {
      identity: { directions: ["outbound"] },
      instructions: {
        system:
          "Remind the contact about an upcoming appointment or outstanding item. Be polite, confirm details, and offer reschedule options. Never pressure or threaten.",
        tone: "courteous",
        responseLength: "short",
      },
      voicemail: { action: "leave_prerecorded" },
    },
  },
  {
    id: "survey",
    name: "Survey",
    agentType: "survey",
    description: "Collect structured feedback after a visit or call.",
    config: {
      identity: { directions: ["outbound"] },
      instructions: {
        system:
          "Conduct a short survey. Ask one question at a time, record answers clearly, and thank the caller.",
        responseLength: "short",
      },
    },
  },
  {
    id: "custom",
    name: "Custom",
    agentType: "custom",
    description: "Blank agent — configure instructions, tools, and knowledge yourself.",
    config: {
      identity: { directions: ["inbound", "outbound"] },
    },
  },
];

export function templateConfig(templateId: string): VoiceAgentConfig {
  const t = VOICE_AGENT_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return structuredClone(DEFAULT_VOICE_CONFIG);
  return {
    ...structuredClone(DEFAULT_VOICE_CONFIG),
    ...t.config,
    identity: { ...DEFAULT_VOICE_CONFIG.identity, ...t.config.identity },
    instructions: {
      ...DEFAULT_VOICE_CONFIG.instructions,
      ...t.config.instructions,
    },
    conversationFlow: t.config.conversationFlow ?? DEFAULT_VOICE_CONFIG.conversationFlow,
    voicemail: { ...DEFAULT_VOICE_CONFIG.voicemail, ...t.config.voicemail },
  };
}
