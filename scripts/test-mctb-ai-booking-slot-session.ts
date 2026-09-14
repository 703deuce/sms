#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { pickSlotsToOffer } from "../src/lib/mctb/ai-booking/slot-presentation";
import {
  resolveCustomerChoiceAmongOfferedSlots,
  resolveOfferedListOrdinalIndex,
} from "../src/lib/mctb/ai-booking/offered-slot-selection";
import { isProviderSlotConflictReason } from "../src/lib/mctb/ai-booking/offered-slot-selection";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

function slot(start: string, id?: string): MctbBookingSlot {
  return {
    slotId: id || `id:${start}`,
    startUtc: start,
    endUtc: start,
    timezone: "America/New_York",
  };
}

const offer = pickSlotsToOffer(
  [
    slot("2026-09-15T13:00:00.000Z", "nine"),
    slot("2026-09-15T14:00:00.000Z", "ten"),
    slot("2026-09-15T15:00:00.000Z", "eleven"),
  ],
  3,
);

assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "10 am")?.slotId, "ten");
assert.equal(resolveCustomerChoiceAmongOfferedSlots(offer, "the 2nd one works")?.slotId, "ten");
assert.equal(resolveOfferedListOrdinalIndex("the second one", 3), 1);
assert.equal(isProviderSlotConflictReason("Calendar conflict at that time"), true);
assert.equal(isProviderSlotConflictReason("network error"), false);

console.log("test-mctb-ai-booking-slot-session: OK");
