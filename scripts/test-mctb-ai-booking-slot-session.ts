#!/usr/bin/env npx tsx
/**
 * Regression: offered session slots must match SMS offer set (not full availability query).
 */
import assert from "node:assert/strict";
import { pickSlotsToOffer } from "../src/lib/mctb/ai-booking/slot-presentation";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

function slot(start: string): MctbBookingSlot {
  return {
    slotId: `id:${start}`,
    startUtc: start,
    endUtc: start,
    timezone: "America/New_York",
  };
}

const many = [
  slot("2026-09-14T14:00:00.000Z"),
  slot("2026-09-14T16:00:00.000Z"),
  slot("2026-09-15T13:00:00.000Z"),
  slot("2026-09-15T15:00:00.000Z"),
  slot("2026-09-15T17:00:00.000Z"),
  slot("2026-09-16T14:00:00.000Z"),
];

const offer = pickSlotsToOffer(many, 3);
assert.equal(offer.length, 3);
assert.ok(offer.every((o) => many.some((m) => m.slotId === o.slotId)));

console.log("test-mctb-ai-booking-slot-session: OK");
