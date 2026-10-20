import type { SelectedAvailabilitySlot } from "./selected-slot";
import type { CalendarBusyInterval } from "./types";

const REVALIDATION_BUFFER_MS = 60_000;

export type SlotRevalidationResult =
  | { ok: true }
  | { ok: false; reason: "SLOT_NO_LONGER_AVAILABLE" | "MICROSOFT_ERROR"; message: string };

export function slotIntervalOverlapsBusy(
  selected: Pick<SelectedAvailabilitySlot, "startUtc" | "endUtc">,
  busy: CalendarBusyInterval[],
): boolean {
  const start = new Date(selected.startUtc);
  const end = new Date(selected.endUtc);
  const windowStart = new Date(start.getTime() - REVALIDATION_BUFFER_MS);
  const windowEnd = new Date(end.getTime() + REVALIDATION_BUFFER_MS);

  return busy.some((b) => {
    const bStart = new Date(b.startUtc);
    const bEnd = new Date(b.endUtc);
    return start < bEnd && end > bStart && bStart < windowEnd && bEnd > windowStart;
  });
}

export function evaluateSlotRevalidation(
  selected: SelectedAvailabilitySlot,
  busy: CalendarBusyInterval[],
): SlotRevalidationResult {
  if (slotIntervalOverlapsBusy(selected, busy)) {
    return {
      ok: false,
      reason: "SLOT_NO_LONGER_AVAILABLE",
      message: "Selected interval overlaps busy calendar time",
    };
  }
  return { ok: true };
}

export function revalidationBusyWindow(selected: SelectedAvailabilitySlot): {
  rangeStartUtc: string;
  rangeEndUtc: string;
} {
  const start = new Date(selected.startUtc);
  const end = new Date(selected.endUtc);
  return {
    rangeStartUtc: new Date(start.getTime() - REVALIDATION_BUFFER_MS).toISOString(),
    rangeEndUtc: new Date(end.getTime() + REVALIDATION_BUFFER_MS).toISOString(),
  };
}
