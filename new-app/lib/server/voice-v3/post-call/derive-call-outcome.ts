import type { CallHistoryStructuredFacts } from "../call-history/summary";

export function deriveVoiceV3PostCallOutcome(
  facts: CallHistoryStructuredFacts,
  callOutcome?: string | null,
): string {
  const o = String(callOutcome || facts.outcomeLabel || "").toLowerCase();
  if (facts.appointmentBooked || o.includes("booked")) return "APPOINTMENT_BOOKED";
  if (facts.callbackRequested || o.includes("callback")) return "CALLBACK_REQUESTED";
  if (o.includes("transfer") && o.includes("fail")) return "TRANSFER_FAILED";
  if (facts.transferred) return "TRANSFER_CONNECTED";
  if (o.includes("emergency")) return "EMERGENCY_ESCALATED";
  if (o.includes("message")) return "MESSAGE_TAKEN";
  if (o.includes("unwanted_solicitation") || o.includes("solicitor")) return "OTHER";
  return "OTHER";
}
