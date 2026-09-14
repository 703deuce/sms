#!/usr/bin/env npx tsx
/**
 * Offered slots: calendar subset = session = SMS. Customer picks by time or ordinal in list.
 */
import assert from "node:assert/strict";
import { pickSlotsToOffer } from "../src/lib/mctb/ai-booking/slot-presentation";
import {
  resolveCustomerChoiceAmongOfferedSlots,
  resolveOfferedListOrdinalIndex,
} from "../src/lib/mctb/ai-booking/offered-slot-selection";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

function slot(start: string, id?: string): MctbBookingSlot {
  return {
    slotId: id || `id:${start}`,
    startUtc: start,
    endUtc: start,
    timezone: "America/New_York",
  };
}

const many = [
  slot("2026-09-15T13:00:00.000Z", "nine"),
  slot("2026-09-15T14:00:00.000Z", "ten"),
  slot("2026-09-15T15:00:00.000Z", "eleven"),
  slot("2026-09-16T14:00:00.000Z", "d"),
];

const offer = pickSlotsToOffer(many, 3);
assert.deepEqual(offer.map((o) => o.slotId), ["nine", "ten", "eleven"]);

assert.equal(resolveOfferedListOrdinalIndex("the 2nd one works", 3), 1);
assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "the second one works")?.slotId, "ten");
assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "11 am works")?.slotId, "eleven");
assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "eleven am")?.slotId, "eleven");
assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "Tuesday at 11am works")?.slotId, "eleven");

console.log("test-mctb-ai-booking-slot-session: OK");
