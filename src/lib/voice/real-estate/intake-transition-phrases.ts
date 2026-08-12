import type { RealEstateFieldDefinition } from "./types";

/** One short non-interactive acknowledgment for the next field task onEnter. */
export function buildIntakeFieldAckPhrase(
  field: RealEstateFieldDefinition,
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  switch (field.field_id) {
    case "budget_or_price_range":
      return `Got it — around ${trimmed}.`;
    case "target_areas":
      return `Got it — ${trimmed}.`;
    case "property_type":
      return `Got it — a ${trimmed}.`;
    case "purchase_timeframe":
    case "seller_timeline":
      return `Got it — ${trimmed}.`;
    default:
      return `Got it — ${trimmed}.`;
  }
}

export const INTAKE_TO_BOOKING_TRANSITION_PHRASE =
  "Perfect — I have what I need. Let me check what times are available.";
