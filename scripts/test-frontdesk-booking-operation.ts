/**
 * Booking operation lifecycle tests.
 * Run: npx tsx scripts/test-frontdesk-booking-operation.ts
 */
import assert from "node:assert/strict";
import {
  calendarToolBlockedReason,
  beginBookingOperation,
  canStartScheduleAppointment,
  isBookingOperationActive,
  markBookingOperationConfirmed,
  markBookingOperationFailed,
} from "../voice-runtime/src/frontdesk/booking-operation";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

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

const ud = baseUserData();
assert.equal(canStartScheduleAppointment(ud), true);

beginBookingOperation(ud, "ST_test");
assert.equal(ud.bookingOperation?.state, "collecting_email");
assert.equal(isBookingOperationActive(ud), true);
assert.equal(canStartScheduleAppointment(ud), false);

const blocked = calendarToolBlockedReason(ud, "list_available_slots");
assert.ok(blocked, "expected calendar lock during active booking");

markBookingOperationConfirmed(ud);
assert.equal(ud.bookingOperation?.state, "confirmed");
assert.equal(isBookingOperationActive(ud), false);
assert.equal(canStartScheduleAppointment(ud), true);

const ud2 = baseUserData();
beginBookingOperation(ud2, "ST_fail");
markBookingOperationFailed(ud2, "calendly_error");
assert.equal(ud2.bookingOperation?.state, "failed");
assert.equal(ud2.bookingOperation?.errorReason, "calendly_error");

console.log("frontdesk booking operation tests: PASS");
