import { randomBytes } from "node:crypto";
import type { AvailabilitySlot } from "./slot-generator";

export interface AvailabilityOfferSet {
  offerSetId: string;
  schedulingGeneration: number;
  createdAt: string;
  timezone: string;
  slots: AvailabilitySlot[];
}

export function createOfferSetId(): string {
  return `offer_set_${randomBytes(6).toString("hex")}`;
}

export function buildAvailabilityOfferSet(input: {
  schedulingGeneration: number;
  timezone: string;
  slots: AvailabilitySlot[];
  at?: Date;
}): AvailabilityOfferSet {
  return {
    offerSetId: createOfferSetId(),
    schedulingGeneration: input.schedulingGeneration,
    createdAt: (input.at ?? new Date()).toISOString(),
    timezone: input.timezone,
    slots: input.slots,
  };
}
