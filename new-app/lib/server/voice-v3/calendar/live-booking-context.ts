import type { BookingFailure, ConfirmedBooking } from "./booking-types";
import type { VoiceV3ThinkingAppendEvent } from "../live-runtime-hooks";

export function buildLiveBookingFailureSessionAppend(
  failure: BookingFailure,
): VoiceV3ThinkingAppendEvent {
  const lines = [
    "Authoritative booking failure (do NOT tell the caller they are booked):",
    `reason=${failure.reason}`,
    failure.message,
    "You may acknowledge the issue and offer to check other times if appropriate.",
  ];
  return { type: "session.thinking.append", content: lines.join("\n"), delegation_id: null };
}

export function buildLiveSlotUnavailableSessionAppend(input: {
  localStart: string;
  timezone: string;
}): VoiceV3ThinkingAppendEvent {
  return {
    type: "session.thinking.append",
    content: [
      "The previously selected appointment time is no longer available.",
      "Do NOT say it was booked.",
      `Prior selection: ${input.localStart} (${input.timezone})`,
      "New availability is being checked. Offer fresh choices when presented.",
    ].join("\n"),
    delegation_id: null,
  };
}

export function buildLiveBookingConfirmedSessionAppend(
  confirmed: ConfirmedBooking,
): VoiceV3ThinkingAppendEvent {
  return {
    type: "session.thinking.append",
    content: [
      "BOOKING CONFIRMED BY MICROSOFT.",
      `Service: ${confirmed.serviceId}`,
      `Start (local): ${confirmed.localStart}`,
      `Timezone: ${confirmed.timezone}`,
      "The appointment now exists in Microsoft.",
      "You MAY tell the caller the appointment is confirmed.",
      "Do not claim confirmation before this message.",
    ].join("\n"),
    delegation_id: null,
  };
}

export function buildLiveBookingInProgressSessionAppend(): VoiceV3ThinkingAppendEvent {
  return {
    type: "session.thinking.append",
    content: [
      "Booking is in progress (revalidating calendar and creating the event).",
      "You may say you are confirming the time — do NOT say booked or confirmed yet.",
    ].join("\n"),
    delegation_id: null,
  };
}
