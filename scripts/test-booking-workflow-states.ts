/**
 * Booking workflow state machine unit tests.
 * Run: npx tsx scripts/test-booking-workflow-states.ts
 */
import assert from "node:assert/strict";
import { setWorkflowState } from "../voice-runtime/src/frontdesk/receptionist/workflow-engine";
import { ensureReceptionistWorkflow } from "../voice-runtime/src/frontdesk/receptionist/workflow-engine";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

function ud(): FrontDeskUserData {
  return {
    workspaceId: "w",
    agentId: "a",
    callId: "c",
    businessName: "Test",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
  };
}

const userData = ud();
const wf = ensureReceptionistWorkflow(userData);
wf.intent = "booking";

setWorkflowState(userData, "BOOKING_COLLECT");
assert.equal(wf.state, "BOOKING_COLLECT");

setWorkflowState(userData, "BOOKING_CHECK_AVAILABILITY");
assert.equal(wf.state, "BOOKING_CHECK_AVAILABILITY");

setWorkflowState(userData, "BOOKING_OFFER_SLOTS", { offeredSlotIds: ["ST_a", "ST_b"] });
assert.deepEqual(wf.offeredSlotIds, ["ST_a", "ST_b"]);

setWorkflowState(userData, "BOOKING_SELECT_SLOT");
assert.equal(wf.state, "BOOKING_SELECT_SLOT");

setWorkflowState(userData, "BOOKING_CONFIRM_SLOT", { selectedSlotId: "ST_b" });
assert.equal(wf.selectedSlotId, "ST_b");

setWorkflowState(userData, "BOOKING_COMMIT");
assert.equal(wf.state, "BOOKING_COMMIT");

setWorkflowState(userData, "BOOKING_DONE", { speechLocked: true });
assert.equal(wf.state, "BOOKING_DONE");
assert.equal(wf.speechLocked, true);

userData.bookingReceipt = {
  slotId: "ST_b",
  bookedTimeLabel: "Tuesday at 2:00 PM",
};
assert.equal(userData.bookingReceipt.slotId, "ST_b");

console.log("✓ booking workflow state tests passed");
