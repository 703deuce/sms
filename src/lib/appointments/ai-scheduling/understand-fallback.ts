/**
 * Deterministic understanding fallback when the model is unavailable.
 */

import type { AppointmentAiContext } from "./context";
import {
  resolveRelativeDatePhrase,
  parseExactTime,
} from "./date-utils";
import type { UnderstandingResult } from "./schema";

function detectIntent(text: string): UnderstandingResult["intent"] {
  const lower = text.toLowerCase();

  if (/weather|stock|joke|recipe|news\b/.test(lower)) return "OUT_OF_SCOPE";
  if (/^(help|info)\b/.test(lower.trim())) return "OUT_OF_SCOPE";

  if (/\b(might not|may not|don't know if i can|not sure if i can|uncertain)\b/.test(lower)) {
    return "CLARIFY";
  }

  if (/\bcancel my\b|\bneed to cancel\b|\bplease cancel\b/.test(lower)) return "CANCEL";
  if (/\breschedule my\b|\bmove my appointment\b/.test(lower)) return "RESCHEDULE";
  if (/\b(could i move|can i move|could we move)\b/.test(lower) && !/\b(yes|book|take)\b/.test(lower)) {
    return "RESCHEDULE";
  }
  if (/\bconfirm\b|\b(yes|y)\b.*\b(confirm|appointment)\b/.test(lower)) return "CONFIRM";
  if (/\bwaitlist\b|\bwait list\b/.test(lower)) return "JOIN_WAITLIST";
  if (/\b(book|schedule)\b/.test(lower)) {
    const hasAnchor =
      /\b(at|for|on)\b/.test(lower) ||
      /\d{1,2}:\d{2}/.test(lower) ||
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/.test(lower);
    if (hasAnchor) return "BOOK";
  }
  if (/\bavailable\b|\bavailability\b|\bdo you have\b|\banything\b|\bopen\b/.test(lower)) {
    return "FIND_AVAILABILITY";
  }
  if (/\bmy appointment\b|\bappointment details\b/.test(lower)) return "APPOINTMENT_DETAILS";
  if (/\b(policy|deposit|fee|cost|price|how much)\b/.test(lower)) {
    return "ANSWER_BOOKING_QUESTION";
  }
  if (/\bappointment\b/.test(lower)) return "CLARIFY";
  return "OUT_OF_SCOPE";
}

function explicitMutation(text: string, intent: UnderstandingResult["intent"]): boolean {
  const lower = text.toLowerCase();
  if (intent === "CANCEL") {
    return /\bcancel my\b|\bneed to cancel\b|\bplease cancel\b/.test(lower);
  }
  if (intent === "RESCHEDULE") {
    return /\bmove my\b|\breschedule my\b|\b(yes|book|take).*\b(slot|time)\b/.test(lower);
  }
  if (intent === "BOOK") {
    return /\b(book|schedule)\b/.test(lower) && /\b(at|for|on|take)\b/.test(lower);
  }
  if (intent === "JOIN_WAITLIST") return /\b(join|add me)\b.*\bwaitlist\b/.test(lower);
  return false;
}

export function parseUnderstandingFallback(
  text: string,
  ctx: AppointmentAiContext,
): UnderstandingResult {
  const intent = detectIntent(text);
  const lower = text.toLowerCase();
  const relative =
    ["today", "tomorrow", "yesterday", "next week"].find((p) => lower.includes(p)) ||
    undefined;
  const date =
    resolveRelativeDatePhrase(text, new Date(ctx.currentTimestamp), ctx.businessTimezone) ||
    null;
  const exactTime = parseExactTime(text) || null;
  let period: "morning" | "afternoon" | "evening" | null = null;
  if (lower.includes("morning")) period = "morning";
  else if (lower.includes("afternoon")) period = "afternoon";
  else if (lower.includes("evening") || lower.includes("after work")) period = "evening";

  let appointmentTypeId: string | null = null;
  let nameMentioned: string | null = null;
  for (const t of ctx.appointmentTypes) {
    if (lower.includes(t.name.toLowerCase())) {
      appointmentTypeId = t.id;
      nameMentioned = t.name;
      break;
    }
  }
  if (!appointmentTypeId && ctx.appointmentTypes.length === 1) {
    appointmentTypeId = ctx.appointmentTypes[0].id;
    nameMentioned = ctx.appointmentTypes[0].name;
  }

  let staffName: string | null = null;
  for (const s of ctx.staff) {
    if (lower.includes(s.name.toLowerCase())) {
      staffName = s.name;
      break;
    }
  }

  const groupMatch = lower.match(/(\d+)\s+(people|spots|seats|guests)/);
  const groupSize = groupMatch ? parseInt(groupMatch[1], 10) : null;

  const requiresClarification =
    intent === "CLARIFY" ||
    (intent === "CANCEL" && ctx.customerAppointments.length > 1) ||
    (intent !== "OUT_OF_SCOPE" && !appointmentTypeId && ctx.appointmentTypes.length > 1 && intent === "FIND_AVAILABILITY");

  return {
    intent,
    confidence: 0.45,
    requiresClarification,
    clarificationReason: requiresClarification
      ? intent === "CLARIFY"
        ? "Uncertain customer intent"
        : "Multiple options may apply"
      : null,
    appointmentReference: { appointmentId: null, description: null },
    servicePreference: { appointmentTypeId, nameMentioned },
    datePreference: {
      raw: relative || null,
      relative: relative || null,
      date,
      dateRange: null,
    },
    timePreference: {
      raw: exactTime,
      exactTime,
      period,
      range: null,
    },
    staffPreference: { staffId: null, nameMentioned: staffName },
    locationPreference: { locationId: null, nameMentioned: null },
    groupSize,
    recurrence: null,
    bookingAnswers: {},
    explicitMutationRequested: explicitMutation(text, intent),
    notesForResolver: [],
    originalText: text,
  };
}
