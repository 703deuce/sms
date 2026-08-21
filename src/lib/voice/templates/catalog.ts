/** Transovo internal LiveKit agent template catalog (mirrors Python registry). */

export type AgentTemplateStatus = "FOUND" | "IMPLEMENTED" | "VERIFIED" | "NOT_APPLICABLE";

export type AgentTemplateRecord = {
  id: string;
  name: string;
  purpose: string;
  officialExample: string;
  livekitSdk: string;
  capabilities: string[];
  requiredEnv: string[];
  importedVerified: string;
  status: AgentTemplateStatus;
};

export const AGENT_TEMPLATE_CATALOG: AgentTemplateRecord[] = [
  {
    id: "livekit_basic_voice",
    name: "Basic Voice Assistant",
    purpose: "Layer 1 — gpt-realtime conversation + interruption",
    officialExample: "livekit/agents/examples/voice_agents/basic_agent.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["realtime_conversation", "function_tools", "interruption"],
    requiredEnv: ["OPENAI_API_KEY", "LIVEKIT_URL"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_frontdesk_booking",
    name: "Front Desk Booking",
    purpose: "Official booking/calendar pattern (FakeCalendar → Transovo calendar)",
    officialExample: "livekit/agents/examples/frontdesk/agent.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["list_slots", "schedule_appointment"],
    requiredEnv: ["OPENAI_API_KEY"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_warm_transfer",
    name: "Warm Transfer",
    purpose: "Official SIP warm transfer",
    officialExample: "livekit/agents/examples/warm-transfer/warm_transfer.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["warm_transfer"],
    requiredEnv: ["LIVEKIT_SIP_OUTBOUND_TRUNK"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "transovo_receptionist_v1",
    name: "AI Receptionist v1",
    purpose: "Production customer receptionist (compiled config + backend tools)",
    officialExample: "Composed from basic + frontdesk + warm-transfer",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: [
      "realtime_conversation",
      "business_knowledge",
      "dynamic_fields",
      "take_message",
      "transfer",
      "booking",
    ],
    requiredEnv: ["TRANSOVO_BACKEND_URL", "OPENAI_API_KEY"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
];

export const DEFAULT_PRODUCTION_TEMPLATE = "transovo_receptionist_v1";

export function getAgentTemplate(id: string): AgentTemplateRecord | undefined {
  return AGENT_TEMPLATE_CATALOG.find((t) => t.id === id);
}
