import type { BookingFailure, ConfirmedBooking } from "./booking-types";

export function buildLiveBookingFailureSessionAppend(failure: BookingFailure): {
  type: "session.thinking.append";
  thinking: string;
} {
  const lines = [
    "Authoritative booking failure (do NOT tell the caller they are booked):",
    `reason=${failure.reason}`,
    failure.message,
    "You may acknowledge the issue and offer to check other times if appropriate.",
  ];
  return { type: "session.thinking.append", thinking: lines.join("\n") };
}

export function buildLiveSlotUnavailableSessionAppend(input: {
  localStart: string;
  timezone: string;
}): { type: "session.thinking.append"; thinking: string } {
  return {
    type: "session.thinking.append",
    thinking: [
      "The previously selected appointment time is no longer available.",
      "Do NOT say it was booked.",
      `Prior selection: ${input.localStart} (${input.timezone})`,
      "New availability is being checked. Offer fresh choices when presented.",
    ].join("\n"),
  };
}

export function buildLiveBookingConfirmedSessionAppend(confirmed: ConfirmedBooking): {
  type: "session.thinking.append";
  thinking: string;
} {
  return {
    type: "session.thinking.append",
    thinking: [
      "BOOKING CONFIRMED BY MICROSOFT.",
      `Service: ${confirmed.serviceId}`,
      `Start (local): ${confirmed.localStart}`,
      `Timezone: ${confirmed.timezone}`,
      "The appointment now exists in Microsoft.",
      "You MAY tell the caller the appointment is confirmed.",
      "Do not claim confirmation before this message.",
    ].join("\n"),
  };
}

export function buildLiveBookingInProgressSessionAppend(): {
  type: "session.thinking.append";
  thinking: string;
} {
  return {
    type: "session.thinking.append",
    thinking: [
      "Booking is in progress (revalidating calendar and creating the event).",
      "You may say you are confirming the time — do NOT say booked or confirmed yet.",
    ].join("\n"),
  };
}
