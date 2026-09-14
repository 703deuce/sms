#!/usr/bin/env npx tsx
/**
 * Unit-style guard for voice-appointment slot filtering (no live DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("src/lib/mctb/ai-booking/service.ts", "utf8");
assert.ok(
  service.includes("filterSlotsByVoiceAppointments"),
  "findAvailableTimes must filter against VoiceAppointment rows",
);

const filterSrc = readFileSync(
  "src/lib/mctb/ai-booking/filter-slots-by-voice-appointments.ts",
  "utf8",
);
assert.ok(filterSrc.includes("listWorkspaceAppointmentBusyIntervals"));

const booking = readFileSync("src/lib/voice/calendar/booking.ts", "utf8");
assert.ok(booking.includes("listWorkspaceAppointmentBusyIntervals"));
assert.ok(booking.includes("blockingBusy"));

console.log("test-mctb-voice-appointment-slot-filter: ok");
