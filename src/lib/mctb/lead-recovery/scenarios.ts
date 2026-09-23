import type { LeadRecoveryIntent, LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";

export const LEAD_RECOVERY_SCENARIO_DEFS: Array<{
  key: LeadRecoveryScenarioKey;
  title: string;
  description: string;
  intents: LeadRecoveryIntent[];
}> = [
  {
    key: "take_message",
    title: "Take a message",
    description: "Collect details and notify your team.",
    intents: ["GENERAL_INQUIRY", "SERVICE_REQUEST", "CALLBACK_REQUEST"],
  },
  {
    key: "booking",
    title: "Booking",
    description: "Schedule appointments when callers want to book.",
    intents: ["BOOKING_REQUEST", "SPECIFIC_TIME_REQUEST", "AVAILABILITY_QUESTION", "RESCHEDULE_REQUEST"],
  },
  {
    key: "emergencies",
    title: "Emergencies",
    description: "Urgent situations and on-call handling.",
    intents: ["EMERGENCY_OR_URGENT"],
  },
  {
    key: "pricing",
    title: "Pricing questions",
    description: "Quotes and estimate requests.",
    intents: ["PRICING_QUESTION", "ESTIMATE_REQUEST"],
  },
  {
    key: "service_area",
    title: "Service-area questions",
    description: "Whether you serve their location.",
    intents: ["SERVICE_AREA_CHECK", "BUSINESS_LOCATION"],
  },
  {
    key: "payments",
    title: "Payments",
    description: "Text-to-Pay when amount is known.",
    intents: ["PAYMENT_REQUEST", "PAYMENT_STATUS_QUESTION"],
  },
  {
    key: "existing_customer",
    title: "Existing-customer issues",
    description: "Prior visits, jobs, and billing.",
    intents: ["EXISTING_CUSTOMER_ISSUE", "CANCEL_REQUEST"],
  },
  {
    key: "general_faq",
    title: "General FAQs",
    description: "Hours, services, and approved answers.",
    intents: ["BUSINESS_HOURS", "BUSINESS_FAQ"],
  },
];

export function intentsForEnabledScenarios(
  scenarios: Partial<Record<LeadRecoveryScenarioKey, boolean>>,
): LeadRecoveryIntent[] {
  const set = new Set<LeadRecoveryIntent>();
  for (const def of LEAD_RECOVERY_SCENARIO_DEFS) {
    if (scenarios[def.key]) {
      for (const i of def.intents) set.add(i);
    }
  }
  set.add("OPT_OUT");
  set.add("WRONG_NUMBER");
  set.add("COMPLAINT");
  set.add("SENSITIVE_OR_HIGH_RISK");
  set.add("UNKNOWN");
  return [...set];
}

export function defaultEnabledScenarios(
  hasAiBooking: boolean,
): Partial<Record<LeadRecoveryScenarioKey, boolean>> {
  return {
    take_message: true,
    booking: hasAiBooking,
    emergencies: true,
    pricing: false,
    service_area: false,
    payments: false,
    existing_customer: false,
    general_faq: false,
  };
}

/** Simplified launch AI Replies profile — FAQ scenario only (not full Lead Recovery catalog). */
export function defaultLaunchEnabledScenarios(): Partial<
  Record<LeadRecoveryScenarioKey, boolean>
> {
  return {
    ...defaultEnabledScenarios(false),
    general_faq: true,
  };
}
