import assert from "node:assert/strict";
import { deriveAppointmentDurationMinutes } from "./public-self-service-duration";
import { resolveAiReschedulerConfig } from "./ai-rescheduler/types";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

const platform = {
  timezone: "America/New_York",
  aiRescheduler: { durationMode: "original" },
} as AppointmentPlatformConfig;
const ar = resolveAiReschedulerConfig(platform);

const start = new Date("2026-10-13T14:00:00.000Z");
const end = new Date("2026-10-13T15:00:00.000Z");
assert.equal(deriveAppointmentDurationMinutes(start, end, ar), 60);

const badEnd = new Date("2026-10-13T14:00:00.000Z");
assert.equal(deriveAppointmentDurationMinutes(start, badEnd, ar), null);

console.log("public-self-service-slots.test.ts: ok");
