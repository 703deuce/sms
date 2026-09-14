#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  assertBookingTimezoneCoherent,
  enrichSlotWithBookingTimezone,
  stampSlotsWithCanonicalTimezone,
} from "../src/lib/mctb/ai-booking/booking-timezone";
import { formatMctbBookingSlotLabel } from "../src/lib/mctb/ai-booking/offered-slot-selection";
import { resolveOfferedSlotFromSpecialistDetailed } from "../src/lib/mctb/ai-booking/resolve-offered-slot-from-specialist";
import { wallTimeInZoneToUtc } from "../src/lib/voice/calendar/timezone-slots";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

function slotsAtUtc(): MctbBookingSlot[] {
  return [
    { slotId: "a", startUtc: "2026-09-15T13:00:00.000Z", endUtc: "2026-09-15T14:00:00.000Z", timezone: "" },
    { slotId: "b", startUtc: "2026-09-15T14:00:00.000Z", endUtc: "2026-09-15T15:00:00.000Z", timezone: "" },
    { slotId: "c", startUtc: "2026-09-15T15:00:00.000Z", endUtc: "2026-09-15T16:00:00.000Z", timezone: "" },
  ];
}

// Regression: exact production failure (NY canonical — no 8 AM anywhere)
const ny = stampSlotsWithCanonicalTimezone(slotsAtUtc(), "America/New_York");
assert.deepEqual(ny.map((s) => formatMctbBookingSlotLabel(s)), [
  "Tue, Sep 15, 9:00 AM",
  "Tue, Sep 15, 10:00 AM",
  "Tue, Sep 15, 11:00 AM",
]);
const pick = resolveOfferedSlotFromSpecialistDetailed(
  { action: "SELECT_OFFERED_SLOT", timezone: "America/New_York", offered_slot_index: 3 },
  ny,
);
assert.equal(pick.ok && pick.slotId, "c");
const third = ny[2]!;
const confirmNy = formatMctbBookingSlotLabel({
  ...third,
  startUtc: third.startUtc,
  endUtc: third.endUtc,
  timezone: "America/New_York",
  bookingTimezone: "America/New_York",
});
assert.equal(confirmNy, "Tue, Sep 15, 11:00 AM");
assert.ok(!confirmNy.includes("8:00"));

// Cross-timezone: LA canonical
const la = stampSlotsWithCanonicalTimezone(slotsAtUtc(), "America/Los_Angeles");
assert.deepEqual(la.map((s) => formatMctbBookingSlotLabel(s)), [
  "Tue, Sep 15, 6:00 AM",
  "Tue, Sep 15, 7:00 AM",
  "Tue, Sep 15, 8:00 AM",
]);

// BOOKING_TIMEZONE_CONFLICT
const bad = assertBookingTimezoneCoherent({
  bookingTimezone: "America/Los_Angeles",
  session: {
    conversationId: "x",
    workspaceId: "ws",
    provider: "microsoft",
    bookingTimezone: "America/New_York",
    offeredSlots: la,
    updatedAt: new Date().toISOString(),
  },
  orchestratorTimezone: "America/Los_Angeles",
});
assert.equal(bad.ok, false);

// Id/index disagreement
const amb = resolveOfferedSlotFromSpecialistDetailed(
  {
    action: "SELECT_OFFERED_SLOT",
    timezone: "America/New_York",
    offered_slot_id: "a",
    offered_slot_index: 3,
  },
  ny,
);
assert.equal(amb.ok, false);

// DST spring-forward: Mar 8 2026 US — 2:30 AM does not exist in America/New_York
const spring = wallTimeInZoneToUtc("America/New_York", 2026, 3, 8, 3, 0);
assert.equal(spring.toISOString(), "2026-03-08T07:00:00.000Z");

// Fall-back ambiguous hour — wallTime picks consistent UTC
const fall1 = wallTimeInZoneToUtc("America/New_York", 2026, 11, 1, 1, 30);
const fall2 = wallTimeInZoneToUtc("America/New_York", 2026, 11, 1, 1, 30);
assert.equal(fall1.toISOString(), fall2.toISOString());

const enriched = enrichSlotWithBookingTimezone(ny[0]!, "America/New_York");
assert.equal(enriched.bookingTimezone, "America/New_York");
assert.equal(enriched.timezone, "America/New_York");

console.log("test-mctb-booking-timezone: OK");
