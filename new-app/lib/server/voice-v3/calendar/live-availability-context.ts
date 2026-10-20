import type { AvailabilityOfferSet } from "./offer-set";
import type { FindAvailabilityFailure } from "./types";

export function buildLiveAvailabilityThinkingContent(input: {
  offerSet: AvailabilityOfferSet | null;
  failure: FindAvailabilityFailure | null;
  schedulingGeneration: number;
  /** Slots Amy may speak aloud (subset of OfferSet). */
  presentedSlotIds?: string[];
}): string {
  if (input.failure) {
    return [
      "Availability search failed (application-owned).",
      `scheduling_generation=${input.schedulingGeneration}`,
      `failure_reason=${input.failure.reason}`,
      "Do not tell the caller specific appointment times.",
      "Explain that scheduling lookup is temporarily unavailable and offer to try another time later.",
    ].join("\n");
  }

  if (!input.offerSet) {
    return [
      "Availability search completed with no authoritative offer set.",
      `scheduling_generation=${input.schedulingGeneration}`,
      "Do not invent appointment times.",
    ].join("\n");
  }

  const lines = [
    "Availability search completed (authoritative).",
    `offer_set_id=${input.offerSet.offerSetId}`,
    `scheduling_generation=${input.offerSet.schedulingGeneration}`,
    `timezone=${input.offerSet.timezone}`,
    "Only the following slots may be presented as available:",
  ];

  const presented =
    input.presentedSlotIds?.length
      ? input.offerSet.slots.filter((s) => input.presentedSlotIds!.includes(s.slotId))
      : input.offerSet.slots;

  if (presented.length === 0) {
    lines.push("(no slots in requested range)");
    lines.push("Tell the caller nothing is available in that range; ask if another day/time works.");
  } else {
    lines.push("Present ONLY these times to the caller (spoken offer):");
    for (const slot of presented) {
      lines.push(`- ${slot.slotId}: ${slot.localStart} to ${slot.localEnd}`);
    }
    if (input.offerSet.slots.length > presented.length) {
      lines.push(
        `(Additional slots exist in the offer set but were not presented — ordinal phrases like "the second one" refer to the spoken list above only.)`,
      );
    }
  }

  lines.push("Never offer a time not listed in the spoken offer above.");
  return lines.join("\n");
}

export function buildLiveAvailabilitySessionAppend(
  offerSet: AvailabilityOfferSet | null,
  failure: FindAvailabilityFailure | null,
  schedulingGeneration: number,
  presentedSlotIds?: string[],
) {
  return {
    type: "session.thinking.append" as const,
    content: buildLiveAvailabilityThinkingContent({
      offerSet,
      failure,
      schedulingGeneration,
      presentedSlotIds,
    }),
    delegation_id: null,
  };
}
