/**
 * First-class Agent product types.
 *
 * Agent = reusable worker (behavior, channels, capabilities) — NOT its trigger.
 * Workflow = when it runs and how nodes/agents connect.
 * Deployment = number / audience / calendar attachment.
 *
 * Type = what the customer created (Appointment Booking Agent, Missed Call Agent).
 * Capabilities = toggles on that agent (booking, transfers, CRM, SMS).
 * Never infer menu placement from capabilities — use type / outcomeSlug only.
 *
 * See `src/lib/agents/architecture.ts` for the locked operating model.
 */

import { getOutcomeSolution } from "@/lib/outcomes/registry";
import type { AgentIntelligenceMode } from "@/lib/agents/architecture";

export type { AgentIntelligenceMode } from "@/lib/agents/architecture";

export const AGENT_TYPE_IDS = [
  "answer_every_call",
  "missed_overflow",
  "after_hours",
  "appointment_booking",
  "lead_capture",
  "service_intake",
  "missed_call_text_back",
  "instant_lead_response",
  "estimate_follow_up",
  "appointment_reminders",
  "review_request",
  "old_lead_reactivation",
  "customer_reactivation",
  "promotional_broadcast",
  "receptionist",
  "custom",
] as const;

export type AgentTypeId = (typeof AGENT_TYPE_IDS)[number];

export type AgentChannel = "voice" | "sms" | "email" | "multi";

export type AgentTypeDef = {
  id: AgentTypeId;
  /** Customer-facing label, e.g. "Appointment Booking Agent". */
  label: string;
  /** Short label for tables/cards. */
  shortLabel: string;
  /** Outcome registry slug this type is created from (default template only). */
  outcomeSlug: string;
  channel: AgentChannel;
  /** Voice family agents share the receptionist runtime. */
  family: "receptionist" | "sms" | "campaign" | "other";
  /**
   * How much of this agent is AI judgment vs deterministic workflow nodes.
   * Promotion blasts stay customer-facing “agents” but are mostly deterministic.
   */
  intelligence: AgentIntelligenceMode;
};

const DEFS: AgentTypeDef[] = [
  {
    id: "answer_every_call",
    label: "AI Answering Agent",
    shortLabel: "AI Answering",
    outcomeSlug: "answer-every-call",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "missed_overflow",
    label: "Cover Missed Calls Agent",
    shortLabel: "Missed / Overflow",
    outcomeSlug: "missed-overflow",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "after_hours",
    label: "After-Hours Agent",
    shortLabel: "After Hours",
    outcomeSlug: "after-hours",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "appointment_booking",
    label: "Appointment Booking Agent",
    shortLabel: "Book Appointments",
    outcomeSlug: "appointment-booking",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "lead_capture",
    label: "Inquiry Capture Agent",
    shortLabel: "Capture & Screen",
    outcomeSlug: "lead-capture",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "service_intake",
    label: "Service Intake Agent",
    shortLabel: "Service Intake",
    outcomeSlug: "service-intake",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "missed_call_text_back",
    label: "Missed Call Text-Back Agent",
    shortLabel: "Missed Call Text Back",
    outcomeSlug: "missed-call-text-back",
    channel: "sms",
    family: "sms",
    intelligence: "mixed",
  },
  {
    id: "instant_lead_response",
    label: "Lead Response Agent",
    shortLabel: "Respond & Follow Up",
    outcomeSlug: "instant-lead-response",
    channel: "sms",
    family: "sms",
    intelligence: "mixed",
  },
  {
    id: "estimate_follow_up",
    label: "Estimate Follow-Up Agent",
    shortLabel: "Estimate Follow-Up",
    outcomeSlug: "estimate-follow-up",
    channel: "sms",
    family: "sms",
    intelligence: "mixed",
  },
  {
    id: "appointment_reminders",
    label: "Appointment Reminder Agent",
    shortLabel: "Reminders",
    outcomeSlug: "appointment-reminders",
    channel: "sms",
    family: "sms",
    intelligence: "mixed",
  },
  {
    id: "review_request",
    label: "Review Request Agent",
    shortLabel: "Reviews",
    outcomeSlug: "review-requests",
    channel: "sms",
    family: "sms",
    intelligence: "deterministic",
  },
  {
    id: "old_lead_reactivation",
    label: "Old Inquiry Reactivation Agent",
    shortLabel: "Old Inquiries",
    outcomeSlug: "old-lead-reactivation",
    channel: "sms",
    family: "campaign",
    intelligence: "deterministic",
  },
  {
    id: "customer_reactivation",
    label: "Past Customer Reactivation Agent",
    shortLabel: "Past Customers",
    outcomeSlug: "customer-reactivation",
    channel: "sms",
    family: "campaign",
    intelligence: "deterministic",
  },
  {
    id: "promotional_broadcast",
    label: "Promotion Agent",
    shortLabel: "Promotions",
    outcomeSlug: "promotional-broadcast",
    channel: "sms",
    family: "campaign",
    intelligence: "deterministic",
  },
  {
    id: "receptionist",
    label: "AI Receptionist",
    shortLabel: "Receptionist",
    outcomeSlug: "ai-receptionist",
    channel: "voice",
    family: "receptionist",
    intelligence: "realtime_ai",
  },
  {
    id: "custom",
    label: "Custom Agent",
    shortLabel: "Custom",
    outcomeSlug: "custom",
    channel: "multi",
    family: "other",
    intelligence: "mixed",
  },
];

export const AGENT_TYPES: Record<AgentTypeId, AgentTypeDef> = Object.fromEntries(
  DEFS.map((d) => [d.id, d]),
) as Record<AgentTypeId, AgentTypeDef>;

const BY_OUTCOME = new Map(DEFS.map((d) => [d.outcomeSlug, d]));

export function isAgentTypeId(value: unknown): value is AgentTypeId {
  return typeof value === "string" && (AGENT_TYPE_IDS as readonly string[]).includes(value);
}

export function getAgentType(id: string | null | undefined): AgentTypeDef {
  if (id && isAgentTypeId(id)) return AGENT_TYPES[id];
  // Legacy aliases
  if (id === "appointment_receptionist") return AGENT_TYPES.appointment_booking;
  if (id === "review_requests") return AGENT_TYPES.review_request;
  return AGENT_TYPES.custom;
}

export function agentTypeFromOutcomeSlug(
  outcomeSlug: string | null | undefined,
): AgentTypeId {
  if (!outcomeSlug) return "custom";
  const hit = BY_OUTCOME.get(outcomeSlug);
  if (hit) return hit.id;
  // Hyphen → underscore fallback when catalog lags a new outcome.
  const asId = outcomeSlug.replace(/-/g, "_");
  if (isAgentTypeId(asId)) return asId;
  return "custom";
}

export function outcomeSlugFromAgentType(
  agentType: string | null | undefined,
): string | null {
  const def = getAgentType(agentType);
  if (def.id === "custom") return null;
  return def.outcomeSlug;
}

export function agentTypeLabel(agentType: string | null | undefined): string {
  return getAgentType(agentType).label;
}

export function agentIntelligence(
  agentType: string | null | undefined,
): AgentIntelligenceMode {
  return getAgentType(agentType).intelligence;
}

export function agentTypeShortLabel(agentType: string | null | undefined): string {
  const def = getAgentType(agentType);
  if (def.id !== "custom") return def.shortLabel;
  // Fall back to outcome registry title when we only have a slug-ish string.
  const outcome = getOutcomeSolution(String(agentType || ""));
  return outcome?.title || "Agent";
}

/** Capability ids stored on receptionist wizard state / draftConfig. */
export const RECEPTIONIST_CAPABILITY_IDS = [
  "answer_questions",
  "take_messages",
  "transfer_calls",
  "book_appointments",
  "qualify_callers",
  "schedule_callbacks",
  "send_sms",
  "crm_lookup",
] as const;

export type ReceptionistCapabilityId =
  (typeof RECEPTIONIST_CAPABILITY_IDS)[number];

export const CAPABILITY_LABELS: Record<string, string> = {
  answer_questions: "FAQ / Business answers",
  take_messages: "Take messages",
  transfer_calls: "Transfers",
  book_appointments: "Booking",
  qualify_callers: "Lead screening",
  schedule_callbacks: "Callbacks",
  send_sms: "SMS",
  crm_lookup: "CRM lookup",
  reminders: "Reminders",
  reviews: "Reviews",
};

export function capabilityLabel(id: string): string {
  return CAPABILITY_LABELS[id] || id.replace(/_/g, " ");
}
