/**
 * Offline tests for frontdesk booking guards and DeepSeek voice request defaults.
 * Run: npx tsx scripts/test-frontdesk-booking-guards.ts
 */
import assert from "node:assert/strict";
import { applyDeepSeekVoiceRequestDefaults } from "../voice-runtime/src/pipeline";
import { alreadyBookedToolMessage } from "../voice-runtime/src/frontdesk/booking-recovery";
import {
  isBookingConfirmed,
  markBookingConfirmed,
  type FrontDeskUserData,
} from "../voice-runtime/src/frontdesk/userdata";

function baseUserData(): FrontDeskUserData {
  return {
    workspaceId: "ws_1",
    agentId: "agent_1",
    callId: "call_1",
    businessName: "Test",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
  };
}

const body: Record<string, unknown> = { model: "deepseek-v4-flash", messages: [] };
applyDeepSeekVoiceRequestDefaults(body);
assert.deepEqual(body.thinking, { type: "disabled" });

const userData = baseUserData();
assert.equal(isBookingConfirmed(userData), false);
assert.equal(alreadyBookedToolMessage(userData), null);

markBookingConfirmed(userData, {
  slotId: "ST_test",
  providerEventId: "https://api.calendly.com/scheduled_events/abc",
  bookedTimeLabel: "Monday at 1 PM",
});

assert.equal(isBookingConfirmed(userData), true);
assert.equal(userData.booking?.status, "confirmed");
assert.equal(userData.booking?.slotId, "ST_test");

const duplicateMsg = alreadyBookedToolMessage(userData);
assert.ok(duplicateMsg);
assert.match(duplicateMsg!, /already_completed/);
assert.match(duplicateMsg!, /Monday at 1 PM/);

console.log("frontdesk booking guards tests: PASS");
