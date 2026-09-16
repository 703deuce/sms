#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  BOOKING_HOLD_EXPIRES_AT,
  BOOKING_HOLD_FLAG,
  BOOKING_HOLD_REASON,
  buildBookingHoldMetadata,
  classifyVoiceAppointmentForAvailability,
  readExplicitBookingHold,
  voiceAppointmentBlocksAvailability,
} from "../src/lib/voice/calendar/voice-appointment-reconcile";

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
    createdAt: new Date("2026-09-11T11:02:39.259Z"),
    metadata: { source: "public_booking" },
  },
  now,
);
assert.equal(staleCert, "ORPHANED_LOCAL_ROW");
assert.equal(voiceAppointmentBlocksAvailability(staleCert), false);

const youngAwaitingNoHold = classifyVoiceAppointmentForAvailability(
  {
    id: "a3",
    workspaceId: "ws_1",
    status: "awaiting_confirmation",
    startsAt: new Date("2026-09-17T18:00:00.000Z"),
    endsAt: new Date("2026-09-17T19:00:00.000Z"),
    timezone: "America/Los_Angeles",
    externalId: null,
    createdAt: new Date("2026-09-16T22:50:00.000Z"),
    metadata: {},
  },
  now,
);
assert.equal(youngAwaitingNoHold, "STALE_UNCONFIRMED");
assert.equal(voiceAppointmentBlocksAvailability(youngAwaitingNoHold), false);

const holdMeta = buildBookingHoldMetadata({
  reason: "voice_v2_book_in_progress",
  expiresAt: new Date(now + 10 * 60 * 1000),
  offerSetId: "v2offer_test",
  slotId: "slot_test",
});
assert.equal(readExplicitBookingHold(holdMeta, now).active, true);

const explicitHold = classifyVoiceAppointmentForAvailability(
  {
    id: "a4",
    workspaceId: "ws_1",
    status: "awaiting_confirmation",
    startsAt: new Date("2026-09-17T18:00:00.000Z"),
    endsAt: new Date("2026-09-17T19:00:00.000Z"),
    timezone: "America/Los_Angeles",
    externalId: null,
    createdAt: new Date("2026-09-16T22:59:00.000Z"),
    metadata: holdMeta,
  },
  now,
);
assert.equal(explicitHold, "VALID_TEMP_HOLD");
assert.equal(voiceAppointmentBlocksAvailability(explicitHold), true);

const expiredHold = classifyVoiceAppointmentForAvailability(
  {
    id: "a5",
    workspaceId: "ws_1",
    status: "awaiting_confirmation",
    startsAt: new Date("2026-09-17T18:00:00.000Z"),
    endsAt: new Date("2026-09-17T19:00:00.000Z"),
    timezone: "America/Los_Angeles",
    externalId: null,
    createdAt: new Date("2026-09-16T22:00:00.000Z"),
    metadata: {
      [BOOKING_HOLD_FLAG]: true,
      [BOOKING_HOLD_REASON]: "voice_v2_book_in_progress",
      [BOOKING_HOLD_EXPIRES_AT]: new Date(now - 1000).toISOString(),
    },
  },
  now,
);
assert.equal(expiredHold, "STALE_UNCONFIRMED");

console.log("test-voice-appointment-reconcile: ok");
