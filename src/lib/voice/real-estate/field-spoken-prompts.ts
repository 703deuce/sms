import type { RealEstateFieldDefinition } from "./types";

/**
 * Caller-facing questions for scripted intake speech.
 * `collection_instruction` on field definitions is model guidance (often third-person);
 * never speak it verbatim to the caller.
 */
const SPOKEN_FIELD_QUESTIONS: Record<string, string> = {
  name: "What's your full name?",
  callback_phone: "If we need to call you back, what's the best number to reach you?",
  preferred_contact_method:
    "How would you like us to follow up — phone call, text, or email?",
  email: "What's the best email for follow-up?",
  target_areas: "What neighborhoods or cities are you looking to buy in?",
  property_type:
    "Are you looking for a single-family home, townhouse, condo, or are you open to a few types?",
  budget_or_price_range: "What's your rough budget or price range?",
  purchase_timeframe:
    "When are you hoping to buy — ASAP, in the next few months, or still exploring?",
  bedrooms: "How many bedrooms do you need?",
  bathrooms: "How many bathrooms would you like?",
  financing_status: "Are you planning to pay cash, use financing, or still figuring that out?",
  preapproval_status:
    "Are you pre-approved for a mortgage, working on it, or not yet?",
  must_have_features:
    "Any must-haves like a garage, yard, or a particular school district?",
  additional_notes: "Anything else that would help your realtor follow up?",
  property_address: "What's the address or neighborhood of the home you're selling?",
  reason_for_selling:
    "What's prompting the sale — relocating, upsizing, downsizing, or something else?",
  desired_timeline: "When are you hoping to list or close?",
  estimated_value_range: "Do you have a rough price range in mind for the home?",
  property_of_interest:
    "Which property are you interested in — an address, MLS number, or a quick description?",
  preferred_showing_time: "When would you like to tour the property?",
  reason_for_call: "What can I help you with today?",
  transaction_reference:
    "Which property or deal are you calling about?",
  agent_name: "What's your name, and which brokerage are you with?",
  brokerage: "What's your brokerage or company name?",
  phone: "What's the best phone number for you?",
  reason_for_call_general: "What brought you to call today?",
};

/** True when text already reads like a direct question to the caller. */
function looksLikeCallerQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return true;
  return /^(what|where|when|how|which|who|do you|can you|are you|would you|could you|may i|tell me)/i.test(
    trimmed,
  );
}

export function callerFacingFieldQuestion(field: RealEstateFieldDefinition): string {
  const scripted = SPOKEN_FIELD_QUESTIONS[field.field_id];
  if (scripted) return scripted;

  const raw = field.collection_instruction?.trim();
  if (raw && looksLikeCallerQuestion(raw)) {
    return raw.endsWith("?") ? raw : `${raw}?`;
  }

  const label = field.label?.trim();
  if (label) {
    return `What is your ${label.toLowerCase()}?`;
  }
  return "Could you tell me a bit more about that?";
}
