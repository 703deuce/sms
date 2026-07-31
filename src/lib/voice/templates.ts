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
      instructions: {
        system:
          "You are the receptionist for the business. Greet callers warmly, identify their needs, and route or take a message. Never claim a transfer succeeded until the system confirms.",
        goals: "Answer professionally, capture caller intent, route or message.",
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
      instructions: {
        system:
          "Qualify leads by asking about service need, timeline, budget, and location. Score leads based on responses. Book appointments only after availability is confirmed.",
        goals: "Determine fit, urgency, and book qualified appointments.",
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
      instructions: {
        system:
          "Help callers book appointments. Always check live availability before offering times. Only confirm booking after the system returns success.",
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
    id: "outbound_follow_up",
    name: "Outbound follow-up",
    agentType: "outbound_follow_up",
    description: "Follow up on leads and quotes.",
    config: {
      identity: { directions: ["outbound"] },
      instructions: {
        system:
          "You are calling to follow up on a prior inquiry. Be brief, respectful of time, and comply with calling regulations.",
      },
    },
  },
];

export function templateConfig(templateId: string): VoiceAgentConfig {
  const t = VOICE_AGENT_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return structuredClone(DEFAULT_VOICE_CONFIG);
  return {
    ...structuredClone(DEFAULT_VOICE_CONFIG),
    ...t.config,
    instructions: {
      ...DEFAULT_VOICE_CONFIG.instructions,
      ...t.config.instructions,
    },
    conversationFlow: t.config.conversationFlow ?? DEFAULT_VOICE_CONFIG.conversationFlow,
  };
}
