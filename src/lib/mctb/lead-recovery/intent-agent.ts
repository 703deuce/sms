import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { getAiBookingRouterModel } from "@/lib/mctb/ai-booking/agents/model-config";
import type {
  LeadRecoveryCollectField,
  LeadRecoveryIntent,
  LeadRecoveryUrgency,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_INTENTS } from "@/lib/mctb/lead-recovery/types";

const STOP_RE = /^(stop|unsubscribe|cancel|end|quit)\b/i;
const WRONG_NUMBER_RE = /\b(wrong number|wrong person|not me|don't know you)\b/i;

const INTENT_AGENT_SYSTEM = `You classify customer SMS for a business lead-recovery product.
Return JSON only. Identify what the customer wants — NOT what the business should do.
Intents (use exact strings): ${LEAD_RECOVERY_INTENTS.join(", ")}.
Keys: primary_intent, secondary_intents (array), lead_type (NEW|EXISTING|UNKNOWN), urgency (LOW|NORMAL|HIGH|EMERGENCY),
service_category (string|null), reason_for_contact (string|null), location ({raw, resolved}), requested_time (string|null),
booking_requested (boolean), callback_requested (boolean), payment_intent (boolean), complaint (boolean),
human_required (boolean), language (string), confidence (0-1), missing_required_fields (array of field ids).
Do not invent business policy. Multiple intents allowed when clearly present.`;

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
    human_required: false,
    language: "en",
    confidence: 0.5,
    missing_required_fields: [],
    ...partial,
  };
}

function isIntent(v: string): v is LeadRecoveryIntent {
  return (LEAD_RECOVERY_INTENTS as readonly string[]).includes(v);
}

export function normalizeStructuredIntent(raw: Record<string, unknown>): StructuredLeadIntent | null {
  const primary = String(raw.primary_intent || "UNKNOWN");
  if (!isIntent(primary)) return null;
  const secondary = Array.isArray(raw.secondary_intents)
    ? raw.secondary_intents
        .map((x) => String(x))
        .filter(isIntent)
    : [];
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) return null;
  const urgencyRaw = String(raw.urgency || "NORMAL").toUpperCase();
  const urgency: LeadRecoveryUrgency =
    urgencyRaw === "LOW" || urgencyRaw === "HIGH" || urgencyRaw === "EMERGENCY"
      ? (urgencyRaw as LeadRecoveryUrgency)
      : "NORMAL";
  const loc = raw.location && typeof raw.location === "object" ? (raw.location as Record<string, unknown>) : {};
  const missing = Array.isArray(raw.missing_required_fields)
    ? (raw.missing_required_fields as LeadRecoveryCollectField[])
    : [];

  return emptyIntent({
    primary_intent: primary,
    secondary_intents: secondary,
    lead_type:
      raw.lead_type === "NEW" || raw.lead_type === "EXISTING" ? raw.lead_type : "UNKNOWN",
    urgency,
    service_category: typeof raw.service_category === "string" ? raw.service_category : null,
    reason_for_contact: typeof raw.reason_for_contact === "string" ? raw.reason_for_contact : null,
    location: {
      raw: typeof loc.raw === "string" ? loc.raw : null,
      resolved: typeof loc.resolved === "string" ? loc.resolved : null,
    },
    requested_time: typeof raw.requested_time === "string" ? raw.requested_time : null,
    booking_requested: raw.booking_requested === true,
    callback_requested: raw.callback_requested === true,
    payment_intent: raw.payment_intent === true,
    complaint: raw.complaint === true,
    human_required: raw.human_required === true,
    language: typeof raw.language === "string" ? raw.language : "en",
    confidence: Math.max(0, Math.min(1, confidence)),
    missing_required_fields: missing,
  });
}

/** Deterministic intent classification — no provider calls, no business policy. */
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

  if (input.sessionPhase === "AWAITING_SLOT_SELECTION" && /\d|first|second|third|works|yes/i.test(text)) {
    return emptyIntent({
      primary_intent: "SPECIFIC_TIME_REQUEST",
      booking_requested: true,
      confidence: 0.98,
    });
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
  if (/\b(serve|service area|come to|do you come)\b/i.test(text) && /\b(stafford|zip|area)\b/i.test(text)) {
    if (primary === "UNKNOWN") primary = "SERVICE_AREA_CHECK";
    else secondary.push("SERVICE_AREA_CHECK");
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
  if (/\b(estimate|bid)\b/i.test(text)) {
    secondary.push("ESTIMATE_REQUEST");
    if (primary === "UNKNOWN") primary = "ESTIMATE_REQUEST";
  }
  if (/\b(stafford|zip|area|serve|come to)\b/i.test(text)) {
    secondary.push("SERVICE_AREA_CHECK");
  }
  if (/\b(open|hours|tonight|closed)\b/i.test(text)) {
    secondary.push("BUSINESS_HOURS");
  }
  if (/\b(yesterday|last time|existing|warranty|billing)\b/i.test(text)) {
    primary = "EXISTING_CUSTOMER_ISSUE";
    confidence = 0.88;
  }
  if (/\b(cancel)\b/i.test(text)) {
    primary = "CANCEL_REQUEST";
  }
  if (/\b(pay|deposit|invoice)\b/i.test(text)) {
    primary = "PAYMENT_REQUEST";
  }
  if (/\b(payment go through|paid|charge)\b/i.test(text)) {
    primary = "PAYMENT_STATUS_QUESTION";
  }
  if (/\b(broke something|terrible|unhappy|complaint)\b/i.test(text)) {
    primary = "COMPLAINT";
    confidence = 0.9;
  }
  if (/\b(vendor|recruit|hiring|seo services)\b/i.test(text)) {
    primary = "SPAM_VENDOR_RECRUITING";
  }
  if (/\b(spanish|español|habla)\b/i.test(text)) {
    secondary.push("LANGUAGE_PREFERENCE");
  }
  if (primary === "UNKNOWN" && /\b(calling about|was calling)\b/i.test(text)) {
    primary = "SERVICE_REQUEST";
    confidence = 0.75;
  }
  if (primary === "UNKNOWN" && text.length > 2) {
    confidence = 0.35;
  }

  const booking_requested =
    primary === "BOOKING_REQUEST" ||
    primary === "SPECIFIC_TIME_REQUEST" ||
    secondary.includes("BOOKING_REQUEST");
  const callback_requested = primary === "CALLBACK_REQUEST" || secondary.includes("CALLBACK_REQUEST");
  const payment_intent = primary === "PAYMENT_REQUEST";
  const complaint = primary === "COMPLAINT";

  return emptyIntent({
    primary_intent: primary,
    secondary_intents: secondary.filter((s) => s !== primary),
    urgency,
    reason_for_contact: text.slice(0, 500),
    booking_requested,
    callback_requested,
    payment_intent,
    complaint,
    confidence,
  });
}

export async function runLeadRecoveryIntentAgent(input: {
  message: string;
  sessionPhase?: string | null;
}): Promise<StructuredLeadIntent> {
  const deterministic = deterministicLeadRecoveryIntent(input);
  if (deterministic.confidence >= 0.9 || deterministic.primary_intent === "OPT_OUT") {
    return deterministic;
  }

  const llm = await aiBookingStructuredJson<Record<string, unknown>>({
    system: INTENT_AGENT_SYSTEM,
    user: JSON.stringify({ message: input.message, session_phase: input.sessionPhase }),
    model: getAiBookingRouterModel(),
    temperature: 0.1,
    maxTokens: 500,
  });
  if (!llm) return deterministic;
  const normalized = normalizeStructuredIntent(llm);
  if (!normalized) return deterministic;
  if (normalized.confidence < deterministic.confidence) return deterministic;
  return normalized;
}
