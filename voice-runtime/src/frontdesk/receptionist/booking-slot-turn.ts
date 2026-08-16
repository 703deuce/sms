import { matchSlotFromInput } from "@/lib/voice/workflow-engine/slot-matching";
import type { AvailableSlot } from "../calendly-calendar";

export function utteranceLooksLikeSlotSelection(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  if (/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(transcript)) return true;
  return /\b(first|second|third|1st|2nd|3rd|earlier|later|that one|that time|works for me|sounds good)\b/.test(
    lower,
  );
}

export function utteranceIndicatesBookingConfirmation(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  return (
    /^(yes|yeah|yep|correct|that's right|that is right|please|go ahead|book it|sure|ok|okay)\b/.test(
      lower,
    ) || /\b(yes|please book|that's correct|that is correct|book it)\b/.test(lower)
  );
}

export function utteranceIndicatesBookingRejection(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  return /\b(no|nope|not that|different time|another time|something else|don't want)\b/.test(lower);
}

export function formatSlotSpokenLabel(slot: AvailableSlot, timezone: string): string {
  const weekday = slot.startTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
  const time = slot.startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${weekday} at ${time}`;
}

/** Match caller utterance to one of the runtime-offered slots (ordinal, time, or ISO). */
export function matchOfferedSlotFromUtterance(
  transcript: string,
  offeredSlotIds: string[],
  slotsMap: Map<string, AvailableSlot>,
  timezone: string,
): AvailableSlot | null {
  if (!transcript.trim() || offeredSlotIds.length === 0) return null;

  const isoStarts = offeredSlotIds
    .map((id) => slotsMap.get(id)?.startTime.toISOString())
    .filter((s): s is string => Boolean(s));

  const matchedIso = matchSlotFromInput(transcript, isoStarts, timezone);
  if (matchedIso) {
    const byIso = offeredSlotIds.find(
      (id) => slotsMap.get(id)?.startTime.toISOString() === matchedIso,
    );
    if (byIso) return slotsMap.get(byIso) ?? null;
  }

  const lower = transcript.trim().toLowerCase();
  for (const slotId of offeredSlotIds) {
    if (lower.includes(slotId.toLowerCase())) {
      return slotsMap.get(slotId) ?? null;
    }
  }

  for (const slotId of offeredSlotIds) {
    const slot = slotsMap.get(slotId);
    if (!slot) continue;
    const label = formatSlotSpokenLabel(slot, timezone).toLowerCase();
    if (lower.includes(label) || label.includes(lower)) return slot;
  }

  return null;
}
