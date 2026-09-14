/**
 * TEST / FIXTURE ONLY — keyword-based intent classifier.
 * Do NOT use in production runtime. Semantic intent must come from the structured LLM intent agent.
 */
import type {
  LeadRecoveryCollectField,
  LeadRecoveryIntent,
  LeadRecoveryUrgency,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";

const STOP_RE = /^(stop|unsubscribe|cancel|end|quit)\b/i;
const WRONG_NUMBER_RE = /\b(wrong number|wrong person|not me|don't know you)\b/i;

function emptyIntent(partial: Partial<StructuredLeadIntent>): StructuredLeadIntent {
  return {
    primary_intent: "UNKNOWN",
    secondary_intents: [],
    lead_type: "UNKNOWN",
    urgency: "NORMAL",
    service_category: null,
    reason_for_contact: null,
    location: { raw: null, resolved: null },
    requested_time: null,
    booking_requested: false,
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_requested: false,
    human_required: false,
    needs_clarification: false,
    extracted_entities: {},
    semantic_missing_information: [],
    booking_disposition: "NONE",
    language: "en",
    confidence: 0.5,
    missing_required_fields: [],
    ...partial,
  };
}

/** @deprecated TEST ONLY — legacy keyword classifier for unit scripts */
export function deterministicLeadRecoveryIntent(input: {
  message: string;
  sessionPhase?: string | null;
}): StructuredLeadIntent {
  const text = input.message.trim();
  const lower = text.toLowerCase();

  if (STOP_RE.test(text)) {
    return emptyIntent({ primary_intent: "OPT_OUT", confidence: 1 });
  }
  if (WRONG_NUMBER_RE.test(lower)) {
    return emptyIntent({ primary_intent: "WRONG_NUMBER", confidence: 0.95 });
  }

  const secondary: LeadRecoveryIntent[] = [];
  let primary: LeadRecoveryIntent = "UNKNOWN";
  let urgency: LeadRecoveryUrgency = "NORMAL";
  let confidence = 0.85;

  if (/\b(pouring|flooding|gas leak|no heat|sparks|emergency|urgent|asap)\b/i.test(text)) {
    primary = "EMERGENCY_OR_URGENT";
    urgency = "EMERGENCY";
    confidence = 0.92;
  }
  if (/\b(leak|broken|repair|install|not working|service)\b/i.test(text) && primary === "UNKNOWN") {
    primary = "SERVICE_REQUEST";
  }
  if (/\b(call me|callback|call back|phone me)\b/i.test(text)) {
    if (primary === "UNKNOWN") primary = "CALLBACK_REQUEST";
    else secondary.push("CALLBACK_REQUEST");
  }
  if (/\b(reschedule|move my appointment|move tomorrow)\b/i.test(text)) {
    primary = "RESCHEDULE_REQUEST";
  } else if (/\b(book|schedule|appointment|come out|tomorrow|available)\b/i.test(text)) {
    if (primary === "UNKNOWN") primary = "BOOKING_REQUEST";
    else secondary.push("BOOKING_REQUEST");
  }
  if (/\b(how much|price|cost|quote)\b/i.test(text)) {
    if (primary === "UNKNOWN") primary = "PRICING_QUESTION";
    else secondary.push("PRICING_QUESTION");
  }
  if (/\b(pay|deposit|invoice)\b/i.test(text)) {
    primary = "PAYMENT_REQUEST";
  }
  if (/\b(payment go through|paid|charge|did my payment)\b/i.test(text)) {
    primary = "PAYMENT_STATUS_QUESTION";
    confidence = 0.93;
  }

  return emptyIntent({
    primary_intent: primary,
    secondary_intents: secondary.filter((s) => s !== primary),
    urgency,
    reason_for_contact: text.slice(0, 500),
    booking_requested:
      primary === "BOOKING_REQUEST" || primary === "SPECIFIC_TIME_REQUEST" || secondary.includes("BOOKING_REQUEST"),
    callback_requested: primary === "CALLBACK_REQUEST" || secondary.includes("CALLBACK_REQUEST"),
    payment_intent: primary === "PAYMENT_REQUEST",
    complaint: primary === "COMPLAINT",
    confidence,
  });
}
