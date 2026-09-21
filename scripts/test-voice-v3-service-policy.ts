import assert from "node:assert/strict";
import {
  clampFindWindowToServiceHorizon,
  serviceAllowsLiveBooking,
  validateSlotAgainstServicePolicy,
} from "../src/lib/voice-v3/policy/service-policy";
import type { VoiceV3ServiceConfig } from "../src/lib/voice-v3/config/agent-config";

const service: VoiceV3ServiceConfig = {
  id: "s1",
  name: "Consult",
  durationMinutes: 30,
  slotStepMinutes: 15,
  minimumBookingNoticeMinutes: 120,
  maximumBookingDaysAhead: 7,
  bookingPermission: "book_directly",
  status: "ready",
  enabled: true,
};

assert.equal(serviceAllowsLiveBooking(service), true);

const now = new Date("2026-09-21T12:00:00.000Z");
const tooSoon = new Date(now.getTime() + 30 * 60_000).toISOString();
assert.equal(
  validateSlotAgainstServicePolicy({
    service,
    slotStartUtc: tooSoon,
    timezone: "America/New_York",
    now,
  }),
  "BELOW_MIN_NOTICE",
);

const clamped = clampFindWindowToServiceHorizon({
  service,
  rangeStartUtc: now.toISOString(),
  rangeEndUtc: new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString(),
  now,
});
assert.ok(new Date(clamped.rangeEndUtc).getTime() <= now.getTime() + 7 * 24 * 60 * 60_000 + 1000);

console.log("test-voice-v3-service-policy: PASS");
