/**
 * Agent type catalog — fixed jobs customers hire, not rebuild.
 * Agent instance = how that job runs for one business (Amy — Fredericksburg).
 */

export type AgentTypeId = "appointment_booking" | "missed_call_text_back";

export type CatalogAgent = {
  typeId: AgentTypeId;
  productName: string;
  roleLabel: string;
  defaultInstanceName: string;
  tagline: string;
  description: string;
  fixedCapabilities: string[];
  notConfigurableAsJob: string[];
  setupHref: string;
  recommendedFirst?: boolean;
  status: "available" | "coming_soon";
};

/**
 * Only show agents that are genuinely complete in the hire chooser.
 */
export const HIREABLE_AGENTS: CatalogAgent[] = [
  {
    typeId: "appointment_booking",
    productName: "Amy",
    roleLabel: "Appointment Booking Agent",
    defaultInstanceName: "Amy",
    tagline: "Answers calls, checks availability, and books appointments.",
    description:
      "Answers calls, answers approved questions, checks availability, books appointments, transfers callers, and sends confirmations.",
    fixedCapabilities: [
      "Book appointments over the phone",
      "Collect required caller information",
      "Check live calendar availability",
      "Offer valid times and confirm details",
      "Hold slots, create and verify appointments",
      "Send confirmation texts when enabled",
      "Record outcomes and fall back when booking fails",
    ],
    notConfigurableAsJob: [
      "Whether she books appointments (always — that is her job)",
      "Core booking workflow steps",
      "Required booking tool classes",
    ],
    setupHref: "/hire/amy",
    recommendedFirst: true,
    status: "available",
  },
  {
    typeId: "missed_call_text_back",
    productName: "John",
    roleLabel: "Missed Call Text Back Agent",
    defaultInstanceName: "John",
    tagline: "Texts missed callers back automatically and handles SMS follow-up.",
    description:
      "Detects missed calls, sends a recovery text after your configured delay, and continues the conversation over SMS.",
    fixedCapabilities: [
      "Detect missed calls",
      "Send recovery SMS",
      "Route inbound replies",
      "Hand structured booking requests to Amy",
    ],
    notConfigurableAsJob: [
      "Whether he recovers missed calls (always — that is his job)",
    ],
    setupHref: "/agents/john",
    status: "available",
  },
];

export function getCatalogAgent(typeId: AgentTypeId): CatalogAgent | undefined {
  return HIREABLE_AGENTS.find((a) => a.typeId === typeId);
}
