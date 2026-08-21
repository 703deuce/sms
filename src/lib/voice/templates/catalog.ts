/** Transovo internal LiveKit agent template catalog (mirrors Python registry). */

export type AgentTemplateStatus =
  | "FOUND"
  | "IMPLEMENTED"
  | "VERIFIED"
  | "COMPOSED_UNVERIFIED"
  | "NOT_APPLICABLE";

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
    purpose: "Phase A — official basic_agent, gpt-realtime, no Transovo tools",
    officialExample: "livekit/agents/examples/voice_agents/basic_agent.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["realtime_conversation", "interruption"],
    requiredEnv: ["OPENAI_API_KEY", "LIVEKIT_URL"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_frontdesk_booking",
    name: "Front Desk Booking",
    purpose: "Phase B — official frontdesk + FakeCalendar",
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
    purpose: "Phase C — official warm transfer",
    officialExample: "livekit/agents/examples/warm-transfer/warm_transfer.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["warm_transfer"],
    requiredEnv: ["LIVEKIT_SIP_OUTBOUND_TRUNK"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_structured_intake",
    name: "Structured Intake",
    purpose: "Phase D — natural multi-field capture",
    officialExample: "livekit/agents/examples/data_capture_sim/agent.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["structured_intake"],
    requiredEnv: ["OPENAI_API_KEY"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_hotel_receptionist",
    name: "Hotel Receptionist",
    purpose: "Phase E — simplified hotel reference",
    officialExample: "livekit/agents/examples/hotel_receptionist/agent.py",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["receptionist", "policy_lookup"],
    requiredEnv: ["OPENAI_API_KEY"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "livekit_knowledge_rag",
    name: "Knowledge RAG",
    purpose: "Phase F — knowledge search lab",
    officialExample: "livekit/agents/examples/voice_agents/llamaindex-rag/",
    livekitSdk: "livekit-agents[openai]>=1.2,<2",
    capabilities: ["search_knowledge"],
    requiredEnv: ["OPENAI_API_KEY"],
    importedVerified: "2026-08-21",
    status: "IMPLEMENTED",
  },
  {
    id: "transovo_receptionist_v1",
    name: "Voice Receptionist v1", // pragma: allowlist secret
    purpose: "Composed — blocked until reference templates VERIFIED (set ALLOW_COMPOSED_RECEPTIONIST=1)",
    officialExample: "Composed from verified LiveKit reference templates",
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
    status: "COMPOSED_UNVERIFIED",
  },
];

/** All PSTN traffic defaults here until templates are individually VERIFIED. */
export const DEFAULT_ACTIVE_TEMPLATE = "livekit_basic_voice";

export function getAgentTemplate(id: string): AgentTemplateRecord | undefined {
  return AGENT_TEMPLATE_CATALOG.find((t) => t.id === id);
}

export function verifiedTemplateIds(): string[] {
  return (process.env.VOICE_VERIFIED_TEMPLATES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function runtimeTemplateStatus(record: AgentTemplateRecord): AgentTemplateStatus {
  if (verifiedTemplateIds().includes(record.id)) return "VERIFIED";
  return record.status;
}
