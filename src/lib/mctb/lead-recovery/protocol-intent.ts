/**
 * Deterministic SMS protocol intents only — not semantic customer understanding.
 */
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

/** Whole-message carrier keywords only — not "Stop." / "Stop looking" / contextual stop. */
const CARRIER_STOP_RE = /^(stop|unsubscribe|end|quit|cancel)$/i;
const HELP_RE = /^help$/i;

export function isBareCarrierStopMessage(message: string): boolean {
  return CARRIER_STOP_RE.test(message.trim());
}

/** Narrow carrier opt-out protocol (compliance). Not conversational "don't cancel it". */
export function isCarrierProtocolOptOutMessage(message: string): boolean {
  return isBareCarrierStopMessage(message);
}
function protocolIntent(partial: Partial<StructuredLeadIntent>): StructuredLeadIntent {
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
    booking_disposition: "NONE",
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_requested: false,
    human_required: false,
    needs_clarification: false,
    extracted_entities: {},
    semantic_missing_information: [],
    language: "en",
    confidence: 1,
    missing_required_fields: [],
    ...partial,
  };
}

/**
 * Returns a intent only for carrier/compliance protocol messages.
 * Returns null when the message requires semantic classification (LLM).
 */
export function protocolLeadRecoveryIntent(input: {
  message: string;
}): StructuredLeadIntent | null {
  const text = input.message.trim();
  const lower = text.toLowerCase();

  if (CARRIER_STOP_RE.test(text)) {
    return protocolIntent({ primary_intent: "OPT_OUT", stop_scope: "GLOBAL_MESSAGING" });
  }
  if (HELP_RE.test(lower)) {
    return protocolIntent({
      primary_intent: "GENERAL_INQUIRY",
      reason_for_contact: "SMS HELP",
      confidence: 1,
    });
  }
  return null;
}
