import type { LeadRecoveryIntent, StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

const FAQ_INTENTS = new Set<LeadRecoveryIntent>([
  "BUSINESS_HOURS",
  "BUSINESS_FAQ",
  "BUSINESS_LOCATION",
  "SERVICE_AREA_CHECK",
  "GENERAL_INQUIRY",
  "PRICING_QUESTION",
]);

const BOOKING_INTENTS = new Set<LeadRecoveryIntent>([
  "BOOKING_REQUEST",
  "AVAILABILITY_QUESTION",
  "SPECIFIC_TIME_REQUEST",
  "RESCHEDULE_REQUEST",
]);

/** Lightweight heuristic — intent agent remains authoritative; this prevents booking from skipping obvious questions. */
export function messageLooksLikeBusinessQuestion(message: string): boolean {
  const m = message.toLowerCase().replace(/\s+/g, " ").trim();
  if (!m || m.length < 4) return false;
  if (m.endsWith("?")) return true;
  const patterns = [
    /\bwhat do you\b/,
    /\bwhat (services|do you (do|offer)|are you)\b/,
    /\bwho are you\b/,
    /\bwhere are you\b/,
    /\b(hours|open|close|closing)\b/,
    /\bhow much\b/,
    /\bdo you (do|offer|service|cover)\b/,
    /\bare you (open|available)\b/,
    /\btell me about\b/,
    /\bwhat('s| is) your\b/,
  ];
  return patterns.some((p) => p.test(m));
}

export function shouldTryKnowledgeBeforeTransactionalFlow(input: {
  classified: StructuredLeadIntent;
  customerMessage: string;
  collectActive: boolean;
  bookingWorkflowActive: boolean;
}): boolean {
  if (input.collectActive || input.bookingWorkflowActive) return false;

  const primary = input.classified.primary_intent;
  if (FAQ_INTENTS.has(primary)) return true;

  const secondaryFaq = input.classified.secondary_intents.some((i) => FAQ_INTENTS.has(i));
  if (secondaryFaq && messageLooksLikeBusinessQuestion(input.customerMessage)) return true;

  if (messageLooksLikeBusinessQuestion(input.customerMessage)) {
    if (BOOKING_INTENTS.has(primary) && input.classified.booking_requested) {
      return true;
    }
    if (!BOOKING_INTENTS.has(primary) || input.classified.needs_clarification) {
      return true;
    }
  }

  return input.classified.needs_clarification && !input.classified.booking_requested;
}

export function faqIntentForKnowledgeReply(classified: StructuredLeadIntent): LeadRecoveryIntent {
  if (
    classified.primary_intent === "BUSINESS_HOURS" ||
    classified.primary_intent === "BUSINESS_FAQ" ||
    classified.primary_intent === "BUSINESS_LOCATION" ||
    classified.primary_intent === "SERVICE_AREA_CHECK" ||
    classified.primary_intent === "GENERAL_INQUIRY" ||
    classified.primary_intent === "PRICING_QUESTION"
  ) {
    return classified.primary_intent;
  }
  const secondary = classified.secondary_intents.find((i) => FAQ_INTENTS.has(i));
  return secondary ?? "BUSINESS_FAQ";
}
