export interface SelectedAvailabilitySlot {
  offerSetId: string;
  slotId: string;
  schedulingGeneration: number;
  startUtc: string;
  endUtc: string;
  localStart: string;
  localEnd: string;
  timezone: string;
}

export interface PresentedOffer {
  offerSetId: string;
  schedulingGeneration: number;
  presentedSlotIds: string[];
  presentedAt: string;
}

export function isSelectedSlotAuthoritative(
  selected: SelectedAvailabilitySlot | null,
  input: { offerSetId: string; schedulingGeneration: number },
): boolean {
  if (!selected) return false;
  return (
    selected.offerSetId === input.offerSetId &&
    selected.schedulingGeneration === input.schedulingGeneration
  );
}
