#!/usr/bin/env npx tsx
/** Classifier tests for Microsoft certified internal ledger (vendored copy). */
import assert from "node:assert/strict";
import {
  BOOKING_HOLD_EXPIRES_AT,
  BOOKING_HOLD_FLAG,
  BOOKING_HOLD_REASON,
  buildBookingHoldMetadata,
  classifyVoiceAppointmentForAvailability,
  readExplicitBookingHold,
  voiceAppointmentBlocksAvailability,
} from "../src/lib/voice-receptionist-wizard/pipelines/microsoft-365-certified/internal/microsoft-local-ledger-busy";

const now = Date.parse("2026-09-16T23:00:00.000Z");

assert.equal(
  classifyVoiceAppointmentForAvailability(
    {
      id: "a1",
      workspaceId: "ws_1",
      status: "confirmed",
      startsAt: new Date("2026-09-17T16:00:00.000Z"),
      endsAt: new Date("2026-09-17T17:00:00.000Z"),
      timezone: "America/Los_Angeles",
      externalId: "graph-event-1",
      createdAt: new Date("2026-09-16T12:00:00.000Z"),
      metadata: { voice_v2: true },
    },
    now,
  ),
  "PROVIDER_CONFIRMED",
);

const staleCert = classifyVoiceAppointmentForAvailability(
  {
    id: "a2",
    workspaceId: "ws_1",
    status: "awaiting_confirmation",
    startsAt: new Date("2026-09-17T16:00:00.000Z"),
    endsAt: new Date("2026-09-17T17:00:00.000Z"),
    timezone: "America/New_York",
    externalId: null,
    createdAt: new Date("2025-09-11T11:02:39.259Z"),
    metadata: { source: "public_booking" },
  },
  now,
);
assert.equal(staleCert, "ORPHANED_LOCAL_ROW");
assert.equal(voiceAppointmentBlocksAvailability(staleCert), false);

const holdMeta = buildBookingHoldMetadata({
  reason: "voice_v2_book_in_progress",
  expiresAt: new Date(now + 10 * 60 * 1000),
  offerSetId: "v2offer_test",
  slotId: "slot_test",
});
assert.equal(readExplicitBookingHold(holdMeta, now).active, true);
assert.equal(holdMeta[BOOKING_HOLD_FLAG], true);
assert.equal(holdMeta[BOOKING_HOLD_REASON], "voice_v2_book_in_progress");
assert.ok(typeof holdMeta[BOOKING_HOLD_EXPIRES_AT] === "string");

console.log("test-microsoft-365-certified-local-ledger: PASS");
