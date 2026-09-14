#!/usr/bin/env npx tsx
/**
 * Regression: SMS offer list = bookable session slots; deterministic customer selection.
 */
import assert from "node:assert/strict";
import {
  pickSlotsToOffer,
  resolveCustomerChoiceAmongOfferedSlots,
} from "../src/lib/mctb/ai-booking/slot-presentation";
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
  slot("2026-09-15T13:00:00.000Z", "a"),
  slot("2026-09-15T15:00:00.000Z", "b"),
  slot("2026-09-15T17:00:00.000Z", "c"),
  slot("2026-09-16T14:00:00.000Z", "d"),
];

const offer = pickSlotsToOffer(many, 3);
assert.equal(offer.length, 3);
assert.deepEqual(offer.map((o) => o.slotId), ["a", "b", "c"]);

const pick11 = resolveCustomerChoiceAmongOfferedSlots(offer, "Tuesday at 11am works");
assert.equal(pick11?.slotId, "b");

const pick2 = resolveCustomerChoiceAmongOfferedSlots(offer, "2");
assert.equal(pick2?.slotId, "b");

console.log("test-mctb-ai-booking-slot-session: OK");
