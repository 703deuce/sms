import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { AvailabilityOfferSet } from "../calendar/offer-set";
import { offerSetPresentationOrder } from "../calendar/presentation";

/** How many slots Amy should present when offerEarliestThree is enabled. */
export const OFFER_EARLIEST_THREE_LIMIT = 3;

/**
 * Authoritative slot ids to present to the caller for the active offer set.
 * When offerEarliestThree is on, returns the first N slots in chronological order.
 * Otherwise returns the full offer set order.
 */
export function derivePresentedSlotIdsForBookingBehavior(
  offerSet: AvailabilityOfferSet,
  config: VoiceV3AgentConfig,
): string[] {
  const order = offerSetPresentationOrder(offerSet);
  const behavior = config.scheduling?.bookingBehavior;
  if (behavior?.offerEarliestThree === true) {
    return order.slice(0, OFFER_EARLIEST_THREE_LIMIT);
  }
  return [...order];
}
