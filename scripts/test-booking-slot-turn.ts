/**
 * Unit tests for runtime-owned booking slot pick + confirm.
 * Run: npx tsx scripts/test-booking-slot-turn.ts
 */
import assert from "node:assert/strict";
import {
  formatSlotSpokenLabel,
  matchOfferedSlotFromUtterance,
  utteranceIndicatesBookingConfirmation,
  utteranceLooksLikeSlotSelection,
} from "../voice-runtime/src/frontdesk/receptionist/booking-slot-turn";
import type { AvailableSlot } from "../voice-runtime/src/frontdesk/calendly-calendar";

const timezone = "America/New_York";
const slot1: AvailableSlot = {
  slotId: "ST_abc12",
  startTime: new Date("2026-08-18T14:00:00.000Z"),
  durationMin: 60,
};
const slot2: AvailableSlot = {
  slotId: "ST_def34",
  startTime: new Date("2026-08-19T10:00:00.000Z"),
  durationMin: 60,
};
const offered = [slot1.slotId, slot2.slotId];
const map = new Map([
  [slot1.slotId, slot1],
  [slot2.slotId, slot2],
]);

assert.ok(utteranceLooksLikeSlotSelection("The second one works"));
assert.ok(utteranceLooksLikeSlotSelection("Tuesday at 2pm"));
assert.ok(!utteranceLooksLikeSlotSelection("What is your name?"));

assert.ok(utteranceIndicatesBookingConfirmation("Yes please"));
assert.ok(utteranceIndicatesBookingConfirmation("Yeah book it"));
assert.ok(!utteranceIndicatesBookingConfirmation("maybe"));

const second = matchOfferedSlotFromUtterance("The second one", offered, map, timezone);
assert.equal(second?.slotId, slot2.slotId);

const first = matchOfferedSlotFromUtterance("the first one please", offered, map, timezone);
assert.equal(first?.slotId, slot1.slotId);

const label = formatSlotSpokenLabel(slot1, timezone);
assert.ok(label.length > 5);

console.log("✓ booking slot turn tests passed");
