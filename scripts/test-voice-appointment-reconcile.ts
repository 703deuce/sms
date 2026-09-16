#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  classifyVoiceAppointmentForAvailability,
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

const freshHold = classifyVoiceAppointmentForAvailability(
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
assert.equal(freshHold, "VALID_TEMP_HOLD");
assert.equal(voiceAppointmentBlocksAvailability(freshHold), true);

console.log("test-voice-appointment-reconcile: ok");
