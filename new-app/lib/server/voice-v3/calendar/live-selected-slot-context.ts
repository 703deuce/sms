import type { SelectedAvailabilitySlot } from "./selected-slot";

export function buildLiveSelectedSlotThinkingContent(selected: SelectedAvailabilitySlot): string {
  return [
    "Authoritative scheduling state (application-owned).",
    "Caller selected an appointment time from the current offer set.",
    `offer_set_id=${selected.offerSetId}`,
    `slot_id=${selected.slotId}`,
    `scheduling_generation=${selected.schedulingGeneration}`,
    `selected_local_start=${selected.localStart}`,
    `selected_local_end=${selected.localEnd}`,
    "This slot is SELECTED but NOT BOOKED.",
    "Never tell the caller the appointment is booked, confirmed, or on the calendar.",
    "You may acknowledge their time choice and continue intake or next steps only.",
  ].join("\n");
}

export function buildLiveSelectedSlotSessionAppend(selected: SelectedAvailabilitySlot) {
  return {
    type: "session.thinking.append" as const,
    content: buildLiveSelectedSlotThinkingContent(selected),
    delegation_id: null,
  };
}
