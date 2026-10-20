import type { AvailabilityOfferSet } from "./offer-set";
import type { PresentedOffer } from "./selected-slot";

/** Deterministic full-set order (explicit, not map iteration). */
export function offerSetPresentationOrder(offerSet: AvailabilityOfferSet): string[] {
  return offerSet.slots.map((s) => s.slotId);
}

/**
 * Default presentation policy: up to 3 slots — first, middle, last in presentation order.
 * Used when recording what Amy should offer unless overridden.
 */
export function deriveDefaultPresentedSlotIds(
  offerSet: AvailabilityOfferSet,
  maxPresented = 3,
): string[] {
  const order = offerSetPresentationOrder(offerSet);
  if (order.length <= maxPresented) return [...order];
  const mid = Math.floor((order.length - 1) / 2);
  const picks = new Set<string>([order[0]!, order[mid]!, order[order.length - 1]!]);
  return order.filter((id) => picks.has(id));
}

export function recordPresentedOffer(input: {
  offerSet: AvailabilityOfferSet;
  presentedSlotIds: string[];
  at?: Date;
}): PresentedOffer {
  const order = offerSetPresentationOrder(input.offerSet);
  const valid = input.presentedSlotIds.filter((id) => order.includes(id));
  return {
    offerSetId: input.offerSet.offerSetId,
    schedulingGeneration: input.offerSet.schedulingGeneration,
    presentedSlotIds: valid,
    presentedAt: (input.at ?? new Date()).toISOString(),
  };
}

export function isPresentedOfferCurrent(
  presented: PresentedOffer | null,
  offerSet: AvailabilityOfferSet | null,
  schedulingGeneration: number,
): boolean {
  if (!presented || !offerSet) return false;
  return (
    presented.offerSetId === offerSet.offerSetId &&
    presented.schedulingGeneration === schedulingGeneration &&
    offerSet.schedulingGeneration === schedulingGeneration
  );
}
