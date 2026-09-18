import type { AvailabilityOfferSet } from "./offer-set";
import type { FindAvailabilityFailure } from "./types";

export function buildLiveAvailabilityThinkingContent(input: {
  offerSet: AvailabilityOfferSet | null;
  failure: FindAvailabilityFailure | null;
  schedulingGeneration: number;
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

  if (input.offerSet.slots.length === 0) {
    lines.push("(no slots in requested range)");
    lines.push("Tell the caller nothing is available in that range; ask if another day/time works.");
  } else {
    for (const slot of input.offerSet.slots) {
      lines.push(`- ${slot.slotId}: ${slot.localStart} to ${slot.localEnd}`);
    }
  }

  lines.push("Never offer a time not listed above.");
  return lines.join("\n");
}

export function buildLiveAvailabilitySessionAppend(offerSet: AvailabilityOfferSet | null, failure: FindAvailabilityFailure | null, schedulingGeneration: number) {
  return {
    type: "session.thinking.append" as const,
    content: buildLiveAvailabilityThinkingContent({
      offerSet,
      failure,
      schedulingGeneration,
    }),
    delegation_id: null,
  };
}
