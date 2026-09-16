import type { VoiceV2CallContext } from "../intake/types";
import type { VoiceV2RecoveryActionTimelineEntry } from "./types";

/** Concise normalized tool/action timeline — no provider secrets. */
export function buildVoiceV2RecoveryActionTimeline(
  ctx: VoiceV2CallContext | null,
): VoiceV2RecoveryActionTimelineEntry[] {
  if (!ctx) return [];
  const entries: VoiceV2RecoveryActionTimelineEntry[] = [];
  const w = ctx.bookingWorkflow;

  if (w?.lastFindRequestedDate || w?.requestedDate) {
    entries.push({ kind: "availability_checked", summary: "Availability was checked on the call." });
  }
  if (ctx.currentOfferSet?.offerSetId) {
    entries.push({
      kind: "slots_offered",
      summary: "Appointment times were offered on the call.",
    });
  }
  if (ctx.bookingState?.selectedSlotId) {
    entries.push({
      kind: "slot_selected",
      summary: "Caller selected a time before disconnect.",
    });
  }
  if (
    w?.nextStage === "BOOK_SELECTED_SLOT" ||
    w?.nextStage === "OFFER_SLOTS"
  ) {
    if (!w?.bookingConfirmed) {
      entries.push({ kind: "booking_in_progress", summary: "Scheduling was in progress at disconnect." });
    }
  }
  if (w?.bookingConfirmed) {
    entries.push({ kind: "booking_confirmed", summary: "Booking confirmed on the call." });
  }
  const transfer = ctx.afterHours?.transfer?.status;
  if (transfer) {
    entries.push({
      kind: "transfer",
      summary: `Transfer status: ${transfer}.`,
    });
  }
  if (ctx.afterHours?.callback?.requested || w?.callbackRequested) {
    entries.push({ kind: "callback", summary: "Callback was discussed or requested." });
  }
  if ((ctx.intakeSaveCount ?? 0) > 0) {
    entries.push({ kind: "intake_saved", summary: "Caller information was saved during the call." });
  }
  return entries;
}
