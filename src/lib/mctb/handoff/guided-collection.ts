import type { MctbHandoffConfigDto, MctbLeadFieldConfig } from "./types";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

const FIELD_PROMPTS: Record<string, string> = {
  caller_name: "What's your name?",
  service_reason: "What can we help you with today?",
  urgency: "How urgent is this?",
  location_zip: "What's your location or ZIP code?",
  service_address: "What's the service address?",
  callback_time: "When is a good time to call you back?",
  customer_type: "Are you a new or existing customer?",
  appointment_intent: "Would you like to schedule an appointment?",
  additional_details: "Anything else we should know?",
};

export function activeGuidedFields(config: MctbHandoffConfigDto): MctbLeadFieldConfig[] {
  return config.fieldSchema
    .filter((f) => f.requirement !== "off")
    .sort((a, b) => {
      const rank = (r: MctbLeadFieldConfig["requirement"]) =>
        r === "required" ? 0 : r === "optional" ? 1 : 2;
      const byReq = rank(a.requirement) - rank(b.requirement);
      return byReq !== 0 ? byReq : a.sortOrder - b.sortOrder;
    });
}

export function nextGuidedField(
  config: MctbHandoffConfigDto,
  captured: Record<string, unknown>,
): MctbLeadFieldConfig | null {
  const fields = activeGuidedFields(config);
  for (const field of fields) {
    const val = captured[field.id];
    if (val == null || String(val).trim() === "") {
      if (field.requirement === "required") return field;
      if (field.requirement === "optional" && !captured[`_asked_${field.id}`]) {
        return field;
      }
    }
  }
  return null;
}

export function guidedCollectionComplete(
  config: MctbHandoffConfigDto,
  captured: Record<string, unknown>,
): boolean {
  const required = config.fieldSchema.filter((f) => f.requirement === "required");
  return required.every((f) => {
    const v = captured[f.id];
    return v != null && String(v).trim() !== "";
  });
}

export function promptForField(field: MctbLeadFieldConfig): string {
  return FIELD_PROMPTS[field.id] || `Could you share your ${field.label.toLowerCase()}?`;
}

export function extractFieldFromReply(
  fieldId: string,
  reply: string,
): string | null {
  const trimmed = reply.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

/** Lead Recovery production path — callback from structured intent, not SMS phrase matching. */
export function callbackRequestedFromStructuredIntent(intent: StructuredLeadIntent): boolean {
  if (intent.callback_requested) return true;
  if (intent.primary_intent === "CALLBACK_REQUEST") return true;
  return intent.secondary_intents.includes("CALLBACK_REQUEST");
}

/**
 * @deprecated Not used on Lead Recovery Telnyx SMS path. Legacy handoff returns false —
 * use {@link callbackRequestedFromStructuredIntent} with intent agent output.
 */
export function detectCallbackIntent(_text: string): boolean {
  return false;
}
