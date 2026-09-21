import assert from "node:assert/strict";
import { buildAvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { derivePresentedSlotIdsForBookingBehavior } from "../src/lib/voice-v3/policy/booking-presentation";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import {
  isBookingVerbalConfirmationRequired,
  isBookingVerbalConfirmationSatisfied,
} from "../src/lib/voice-v3/booking/verbal-confirmation";

function slot(i: number) {
  const day = String(20 + i).padStart(2, "0");
  return {
    slotId: `slot_${i}`,
    startUtc: `2026-09-${day}T14:00:00.000Z`,
    endUtc: `2026-09-${day}T15:00:00.000Z`,
    localStart: `2026-09-${day}T10:00:00`,
    localEnd: `2026-09-${day}T11:00:00`,
  };
}

const offer = buildAvailabilityOfferSet({
  schedulingGeneration: 1,
  timezone: "America/New_York",
  slots: [slot(1), slot(2), slot(3), slot(4), slot(5)],
});

const configEarliestThree = {
  ...VOICE_V3_BOOKING_AGENT_CONFIG,
  scheduling: {
    ...VOICE_V3_BOOKING_AGENT_CONFIG.scheduling,
    bookingBehavior: {
      ...VOICE_V3_BOOKING_AGENT_CONFIG.scheduling.bookingBehavior,
      offerEarliestThree: true,
    },
  },
};

const presented = derivePresentedSlotIdsForBookingBehavior(offer, configEarliestThree);
assert.equal(presented.length, 3);
assert.deepEqual(presented, ["slot_1", "slot_2", "slot_3"]);

const configAll = {
  ...configEarliestThree,
  scheduling: {
    ...configEarliestThree.scheduling,
    bookingBehavior: {
      ...configEarliestThree.scheduling.bookingBehavior,
      offerEarliestThree: false,
    },
  },
};
assert.equal(derivePresentedSlotIdsForBookingBehavior(offer, configAll).length, 5);

const confirmConfig = {
  ...VOICE_V3_BOOKING_AGENT_CONFIG,
  scheduling: {
    ...VOICE_V3_BOOKING_AGENT_CONFIG.scheduling,
    bookingBehavior: {
      ...VOICE_V3_BOOKING_AGENT_CONFIG.scheduling.bookingBehavior,
      confirmBeforeBooking: true,
    },
  },
};
assert.equal(isBookingVerbalConfirmationRequired(confirmConfig), true);
assert.equal(isBookingVerbalConfirmationSatisfied(confirmConfig, "AWAITING"), false);
assert.equal(isBookingVerbalConfirmationSatisfied(confirmConfig, "CONFIRMED"), true);

console.log("test-voice-v3-booking-behavior-policy: PASS");
