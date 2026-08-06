/**
 * Structured responsibility for Appointment Booking Agent.
 * Stored on draftConfig.advanced.agentOperating.responsibility — not only in prompts.
 */

import type { AppointmentBookingAgentView, BookingPolicy } from "@/lib/agents/appointment-booking/types";

export type AutonomyBudget = "conservative" | "standard" | "high";

export type AgentCapabilityPause = {
  confirmationSms?: boolean;
  transfers?: boolean;
  booking?: boolean;
  reason?: string;
  pausedAt?: string;
};

export type AgentResponsibility = {
  role: "appointment_booking";
  mainObjective: string;
  successCriteria: string[];
  allowedActions: string[];
  prohibitedActions: string[];
  serves: {
    locations: string[];
    phoneNumbers: string[];
    calendars: string[];
    services: string[];
  };
  transferWhen: string[];
  escalateWhen: string[];
  measuredResults: string[];
  autonomyBudget: AutonomyBudget;
  capabilityPauses: AgentCapabilityPause;
};

export const DEFAULT_AUTONOMY_BUDGET: AutonomyBudget = "standard";

export function buildAgentResponsibility(
  agent: AppointmentBookingAgentView,
  overrides?: Partial<AgentResponsibility>,
): AgentResponsibility {
  const policy = agent.bookingPolicy;
  const allowed: string[] = [
    "Answer inbound calls assigned to this agent",
    "Ask booking questions and collect required fields",
    "Resolve relative dates via resolve_datetime",
    "Check live calendar availability",
    "Hold slots briefly while confirming",
  ];
  if (policy.canBook) allowed.push("Book approved services after caller confirmation");
  if (policy.canReschedule) allowed.push("Reschedule existing appointments");
  if (policy.canCancel) allowed.push("Cancel existing appointments");
  if (policy.sendSmsConfirmation) allowed.push("Send booking confirmation SMS");
  if (policy.sendEmailConfirmation) allowed.push("Send booking confirmation email");
  allowed.push("Transfer or take a message when configured");
  allowed.push("Explain own settings, health, logs, and metrics to the owner");
  allowed.push("Draft booking-policy and workflow changes (activation requires confirmation)");

  const prohibited: string[] = [
    "Invent prices, guarantees, medical/legal advice, or unapproved policies",
    "Claim an appointment is booked unless create/book_appointment succeeded",
    "Book services outside allowedServices",
    "Bypass minimum notice, max advance, or same-day cutoff gates",
    "Generate or execute arbitrary code",
    "Mutate production settings without confirm:true",
    "Reconnect OAuth calendars or change compliance rules automatically",
    "Reassign production numbers or launch bulk campaigns",
  ];
  if (!policy.canCancel) prohibited.push("Cancel appointments (disabled by policy)");
  if (!policy.canReschedule) prohibited.push("Reschedule appointments (disabled by policy)");
  if (!policy.canBook) prohibited.push("Create calendar bookings (booking disabled)");

  return {
    role: "appointment_booking",
    mainObjective:
      overrides?.mainObjective ||
      agent.identity.description ||
      "Answer calls, check real availability, and book appointments using the assigned calendar.",
    successCriteria: overrides?.successCriteria || [
      "Caller intent understood",
      "Required fields collected",
      "Datetime normalized and confirmed",
      "Live availability checked",
      "Appointment created in the connected calendar when booking succeeds",
      "Confirmation SMS attempted when enabled",
      "Call outcome and execution trace stored",
    ],
    allowedActions: overrides?.allowedActions || allowed,
    prohibitedActions: overrides?.prohibitedActions || prohibited,
    serves: overrides?.serves || {
      locations: agent.businessBrain.locations.map((l) => l.name),
      phoneNumbers: agent.phoneNumberE164 ? [agent.phoneNumberE164] : [],
      calendars: agent.resources.calendarLabel
        ? [agent.resources.calendarLabel]
        : [],
      services:
        policy.allowedServices.length > 0
          ? policy.allowedServices
          : agent.businessBrain.services.map((s) => s.name),
    },
    transferWhen: overrides?.transferWhen || [
      "Caller requests a human",
      "Emergency / unsupported service per policy",
      "Repeated booking tool failure after fallback",
      ...(agent.profile.transferPolicySummary
        ? [agent.profile.transferPolicySummary]
        : []),
    ],
    escalateWhen: overrides?.escalateWhen || [
      "Calendar unauthorized or disconnected",
      "Phone routing unhealthy",
      "Duplicate consequential actions detected",
      "Owner approval required for production changes",
    ],
    measuredResults: overrides?.measuredResults || [
      "callsAnswered",
      "appointmentsBooked",
      "bookingConversionRate",
      "transfers",
      "bookingFailures",
      "confirmationSmsSent",
    ],
    autonomyBudget: overrides?.autonomyBudget || DEFAULT_AUTONOMY_BUDGET,
    capabilityPauses: overrides?.capabilityPauses || {},
  };
}

export function policyAllowsAction(
  policy: BookingPolicy,
  pauses: AgentCapabilityPause,
  action: "book" | "sms" | "transfer" | "reschedule" | "cancel",
): boolean {
  if (action === "book" && (pauses.booking || !policy.canBook)) return false;
  if (action === "sms" && (pauses.confirmationSms || !policy.sendSmsConfirmation))
    return false;
  if (action === "transfer" && pauses.transfers) return false;
  if (action === "reschedule" && !policy.canReschedule) return false;
  if (action === "cancel" && !policy.canCancel) return false;
  return true;
}
