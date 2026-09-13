import type { IntentPolicyShape, LeadRecoveryIntent } from "@/lib/mctb/lead-recovery/types";

export const DEFAULT_LEAD_RECOVERY_FALLBACK: IntentPolicyShape = {
  enabled: true,
  collect: ["NAME", "REASON"],
  actions: ["SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
  customerMessage: "Thanks — someone from our team will follow up shortly.",
};

export function defaultIntentPolicies(bookingMode: "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY"): Partial<
  Record<LeadRecoveryIntent, IntentPolicyShape>
> {
  const bookingActions =
    bookingMode === "AI_BOOK"
      ? (["AI_BOOK"] as const)
      : bookingMode === "SEND_BOOKING_LINK"
        ? (["SEND_BOOKING_LINK"] as const)
        : (["CREATE_CALLBACK_REQUEST", "SEND_EMAIL_SUMMARY"] as const);

  return {
    OPT_OUT: {
      enabled: true,
      collect: [],
      actions: ["SUPPRESS_CONTACT", "END_AUTOMATION"],
      customerMessage: "You've been unsubscribed. Reply START to opt back in.",
    },
    WRONG_NUMBER: {
      enabled: true,
      collect: [],
      actions: ["END_AUTOMATION", "CUSTOMER_MESSAGE"],
      customerMessage: "Sorry about that — we won't message you again.",
    },
    EMERGENCY_OR_URGENT: {
      enabled: true,
      collect: ["ADDRESS", "ISSUE_DESCRIPTION"],
      actions: ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage: "Someone will contact you shortly.",
    },
    BOOKING_REQUEST: {
      enabled: true,
      collect: ["APPOINTMENT_PREFERENCE"],
      actions: [...bookingActions],
    },
    SPECIFIC_TIME_REQUEST: {
      enabled: true,
      collect: ["APPOINTMENT_PREFERENCE"],
      actions: [...bookingActions],
    },
    CALLBACK_REQUEST: {
      enabled: true,
      collect: ["CALLBACK_NUMBER", "CALLBACK_TIME", "REASON"],
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage: "Got it — we'll call you back as soon as we can.",
    },
    PRICING_QUESTION: {
      enabled: true,
      collect: ["ADDRESS", "SERVICE_CATEGORY"],
      mode: "ESTIMATE_REQUIRED",
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage:
        "I can have the team provide an exact quote. What's the service address?",
    },
    COMPLAINT: {
      enabled: true,
      collect: ["ISSUE_DESCRIPTION"],
      actions: ["ESCALATE_HUMAN", "SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
      customerMessage: "I'm sorry to hear that. I've alerted our team.",
    },
    GENERAL_INQUIRY: {
      enabled: true,
      collect: ["NAME", "REASON"],
      actions: ["SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
      customerMessage: "Thanks for reaching out — how can we help?",
    },
    SERVICE_REQUEST: {
      enabled: true,
      collect: ["ADDRESS", "ISSUE_DESCRIPTION", "URGENCY"],
      actions: ["SEND_EMAIL_SUMMARY", "CREATE_CALLBACK_REQUEST"],
    },
    UNKNOWN: {
      enabled: true,
      collect: ["REASON"],
      actions: ["CUSTOMER_MESSAGE"],
      customerMessage: "Sure — what were you calling about?",
    },
  };
}
