/** Transovo-owned platform sender response identifiers (code registry — not customer-editable). */
export type PlatformResponseId =
  | "ACKNOWLEDGE_NEED"
  | "ASK_NAME"
  | "ASK_NEED"
  | "ASK_LOCATION"
  | "ASK_URGENCY"
  | "ASK_CALLBACK_TIME"
  | "CALLBACK_CONFIRMED"
  | "SEND_BOOKING_LINK"
  | "HANDOFF_OWNER_FOLLOWUP"
  | "OPT_OUT_ACK"
  | "SAFE_FALLBACK";

export const PLATFORM_RESPONSE_IDS: PlatformResponseId[] = [
  "ACKNOWLEDGE_NEED",
  "ASK_NAME",
  "ASK_NEED",
  "ASK_LOCATION",
  "ASK_URGENCY",
  "ASK_CALLBACK_TIME",
  "CALLBACK_CONFIRMED",
  "SEND_BOOKING_LINK",
  "HANDOFF_OWNER_FOLLOWUP",
  "OPT_OUT_ACK",
  "SAFE_FALLBACK",
];

export function isPlatformResponseId(value: string): value is PlatformResponseId {
  return (PLATFORM_RESPONSE_IDS as string[]).includes(value);
}
