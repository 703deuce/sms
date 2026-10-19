import "server-only";

export function classifyCallIntent(input: {
  transcript?: string | null;
  outcome?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
}): { intent: string; followUp: "open" | "closed" } {
  const t = (input.transcript || "").toLowerCase();
  const outcome = (input.outcome || "").toLowerCase();

  if (input.transferred || outcome === "transferred") {
    return { intent: "transfer", followUp: "closed" };
  }
  if (outcome === "booked" || input.appointmentBooked) {
    return { intent: "book_appointment", followUp: "closed" };
  }
  if (outcome === "rescheduled") {
    return { intent: "reschedule_appointment", followUp: "closed" };
  }
  if (outcome === "cancelled") {
    return { intent: "cancel_appointment", followUp: "closed" };
  }
  if (outcome === "callback_requested" || /callback|call me back/i.test(t)) {
    return { intent: "callback_requested", followUp: "open" };
  }
  if (/i don'?t know|not sure|unknown|can'?t answer/i.test(t)) {
    return { intent: "knowledge_gap_unknown", followUp: "open" };
  }
  if (/book|schedule|appointment/i.test(t)) {
    return { intent: "scheduling_inquiry", followUp: "open" };
  }
  return { intent: "general_inquiry", followUp: "closed" };
}
