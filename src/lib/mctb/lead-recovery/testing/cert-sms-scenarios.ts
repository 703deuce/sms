export type SmsCertScenario = {
  id: string;
  category: "ordinary" | "multi_slot" | "compliance";
  facts: Record<string, unknown>;
  fallbackText: string;
  /** 3+ segments allowed only when true */
  allowThreePlusSegments?: boolean;
};

export const SMS_PHRASING_CERT_SCENARIOS: SmsCertScenario[] = [
  {
    id: "sms-booking-tomorrow",
    category: "ordinary",
    facts: { intent: "schedule", customer_wants: "tomorrow afternoon", next_step: "ask_time" },
    fallbackText: "Sure — I can check tomorrow afternoon. What time works best?",
  },
  {
    id: "sms-emergency-flood",
    category: "ordinary",
    facts: { urgency: "emergency", issue: "basement flooding", next_step: "collect_address" },
    fallbackText: "Got it — flooding is urgent. What's the service address?",
  },
  {
    id: "sms-hours",
    category: "ordinary",
    facts: { question: "hours", answer: "We close at 6 PM today." },
    fallbackText: "We close at 6 PM today.",
  },
  {
    id: "sms-pricing",
    category: "ordinary",
    facts: { question: "diagnostic_fee", amount: "$89", next_step: "optional_issue" },
    fallbackText: "Our diagnostic fee is $89. What issue are you having?",
  },
  {
    id: "sms-booked",
    category: "ordinary",
    facts: { booking_confirmed: true, time: "Friday 3 PM" },
    fallbackText: "You're booked for Friday at 3 PM.",
  },
  {
    id: "sms-callback",
    category: "ordinary",
    facts: { callback_requested: true },
    fallbackText: "Got it — we'll call you back soon.",
  },
  {
    id: "sms-slot-list",
    category: "multi_slot",
    facts: {
      offered_slots: ["Tomorrow 10 AM", "Tomorrow 1 PM", "Tomorrow 3:30 PM"],
      next_step: "pick_slot",
    },
    fallbackText: "Tomorrow I have 10 AM, 1 PM, or 3:30 PM. Which works?",
    allowThreePlusSegments: true,
  },
];

/** Runtime template replies (no LLM) — must stay segment-efficient. */
export const DETERMINISTIC_SMS_TEMPLATE_CHECKS: Array<{
  id: string;
  category: "ordinary" | "multi_slot";
  body: string;
  allowThreePlusSegments?: boolean;
}> = [
  { id: "tpl-collect-address", category: "ordinary", body: "What's the service address?" },
  { id: "tpl-opt-out", category: "ordinary", body: "You've been unsubscribed." },
  {
    id: "tpl-booking-link",
    category: "ordinary",
    body: "You can pick a time here: https://example.com/book",
  },
];
