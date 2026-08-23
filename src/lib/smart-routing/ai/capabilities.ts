/**
 * Canonical Smart Routing capabilities — derived registry for AI alignment.
 */

export type SmartRoutingCapability = {
  id: string;
  label: string;
  description: string;
  supported: boolean;
};

export const SMART_ROUTING_AI_CAPABILITIES: SmartRoutingCapability[] = [
  {
    id: "menu",
    label: "Phone menu (DTMF)",
    description: "Callers press digits to choose Sales, Service, Billing, etc.",
    supported: true,
  },
  {
    id: "call_gate",
    label: "Call Gate",
    description: "Require callers to press a key before phones ring (spam reduction).",
    supported: true,
  },
  {
    id: "ring_one",
    label: "Ring one destination",
    description: "Route to a single person or phone number.",
    supported: true,
  },
  {
    id: "simultaneous_ring",
    label: "Simultaneous ring",
    description: "Ring multiple destinations at the same time.",
    supported: true,
  },
  {
    id: "sequential_ring",
    label: "Sequential ring",
    description: "Ring destinations one after another with timeouts.",
    supported: true,
  },
  {
    id: "schedule",
    label: "Business hours schedule",
    description: "Different routing during open vs closed hours.",
    supported: true,
  },
  {
    id: "after_hours",
    label: "After-hours routing",
    description: "Emergency option, voicemail, or on-call routing after closing.",
    supported: true,
  },
  {
    id: "voicemail",
    label: "Business voicemail",
    description: "Collect voicemail when nobody answers.",
    supported: true,
  },
  {
    id: "callback_request",
    label: "Callback request",
    description: "Let callers request a callback.",
    supported: true,
  },
  {
    id: "mctb_fallback",
    label: "Missed Call Text Back fallback",
    description: "Optional SMS recovery when calls are not answered.",
    supported: true,
  },
  {
    id: "temporary_closure",
    label: "Close Now / temporary closure",
    description: "Temporarily treat business as closed until a set time.",
    supported: true,
  },
  {
    id: "announcement",
    label: "Announcement / play prompt",
    description: "Play a message without routing.",
    supported: true,
  },
  {
    id: "nested_menu",
    label: "Nested menu / subflow",
    description: "Multi-level phone menus.",
    supported: true,
  },
  {
    id: "business_callback",
    label: "Business Callback",
    description:
      "Authorized employees call the Business Callback Number with PIN to return calls showing verified business caller ID.",
    supported: true,
  },
  {
    id: "ai_voice_receptionist",
    label: "AI voice receptionist on live calls",
    description: "NOT supported in Smart Routing — live calls remain deterministic.",
    supported: false,
  },
  {
    id: "caller_sentiment_routing",
    label: "Route based on caller emotion/sentiment",
    description: "NOT supported.",
    supported: false,
  },
];

export function formatCapabilitiesForPrompt(): string {
  return SMART_ROUTING_AI_CAPABILITIES
    .map((c) =>
      c.supported
        ? `- ${c.label}: ${c.description}`
        : `- ${c.label}: UNSUPPORTED — ${c.description}`,
    )
    .join("\n");
}

export function isSupportedCapabilityRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const unsupported = SMART_ROUTING_AI_CAPABILITIES.filter((c) => !c.supported);
  return !unsupported.some((c) => lower.includes(c.id.replace(/_/g, " ")));
}
