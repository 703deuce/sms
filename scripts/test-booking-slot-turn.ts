/**
 * Unit tests for deterministic + semantic slot resolution helpers (no network).
 * Run: npx tsx scripts/test-booking-slot-turn.ts
 */
import assert from "node:assert/strict";
import {
  matchOfferedSlotDeterministic,
  parseSemanticSlotPayloadForTest,
  resolveOrdinalSlotForTest,
  utteranceIndicatesBookingConfirmation,
  utteranceLooksLikeSlotSelection,
} from "../voice-runtime/src/frontdesk/receptionist/booking-slot-semantic";
import { formatSlotSpokenLabel } from "../voice-runtime/src/frontdesk/receptionist/booking-slot-turn";
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

assert.ok(utteranceLooksLikeSlotSelection("The later one"));
assert.ok(utteranceLooksLikeSlotSelection("Tuesday afternoon"));
assert.ok(utteranceLooksLikeSlotSelection("anything after lunch"));
assert.ok(!utteranceLooksLikeSlotSelection("What is your name?"));

assert.ok(utteranceIndicatesBookingConfirmation("Yes please"));

const second = matchOfferedSlotDeterministic("The second one", offered, map, timezone);
assert.equal(second?.slotId, slot2.slotId);

const later = matchOfferedSlotDeterministic("the later one", offered, map, timezone);
assert.equal(later?.slotId, slot2.slotId);

const payload = parseSemanticSlotPayloadForTest('{"slot_id":"ST_def34","ordinal":2}');
assert.equal(payload?.slot_id, "ST_def34");
assert.equal(resolveOrdinalSlotForTest(2, offered), slot2.slotId);

const label = formatSlotSpokenLabel(slot1, timezone);
assert.ok(label.length > 5);

console.log("✓ booking slot turn tests passed");
