/**
 * Unit tests for receptionist runtime workflow conductor.
 * Run: npx tsx scripts/test-receptionist-workflow-engine.ts
 */
import assert from "node:assert/strict";
import { parseToolFeedbackFromModel } from "../src/lib/voice/tool-feedback";
import {
  activateBookingWorkflow,
  bookingFieldsComplete,
  enterCollectionState,
  ensureReceptionistWorkflow,
  transitionAfterRecordField,
  transitionFromToolFeedback,
} from "../voice-runtime/src/frontdesk/receptionist/workflow-engine";
import {
  allowedToolNamesForWorkflow,
  isToolAllowedInWorkflow,
} from "../voice-runtime/src/frontdesk/receptionist/workflow-tool-surface";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

function baseUserData(): FrontDeskUserData {
  return {
    workspaceId: "w",
    agentId: "a",
    callId: "c",
    businessName: "Test",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistCompiled: {
      businessName: "Test",
      timezone: "America/New_York",
      greeting: "Hi",
      capabilities: ["book_appointments", "collect_info", "take_messages"],
      fieldManifest: [
        { id: "name", label: "name", required: true, question: "What is your name?" },
        { id: "phone", label: "phone", required: true, question: "What is your phone?" },
        { id: "address", label: "address", required: true, question: "What is your address?" },
        { id: "reason", label: "reason", required: true, question: "What is the issue?" },
      ],
      actionPermissions: {},
      compiledPrompt: "",
    },
    receptionistFields: {},
    receptionistToolNames: [
      "record_current_field",
      "take_message",
      "list_available_slots",
      "schedule_appointment",
      "end_call",
      "get_business_answer",
    ],
  };
}

const ud = baseUserData();
ensureReceptionistWorkflow(ud);

assert.equal(isToolAllowedInWorkflow(ud, ensureReceptionistWorkflow(ud), "list_available_slots"), true);

enterCollectionState(ud, "booking");
assert.equal(ud.receptionistWorkflow?.state, "BOOKING_COLLECT");
assert.ok(ud.receptionistWorkflow?.activeFieldId, "active field set during collection");
assert.equal(
  isToolAllowedInWorkflow(ud, ensureReceptionistWorkflow(ud), "list_available_slots"),
  false,
  "list_available_slots blocked during BOOKING_COLLECT",
);
assert.equal(
  isToolAllowedInWorkflow(ud, ensureReceptionistWorkflow(ud), "record_current_field"),
  true,
);

ud.receptionistFields = { name: "Jane", phone: "4045551212", address: "1 Main St", reason: "AC" };
transitionAfterRecordField(ud, "booking");
assert.equal(ud.receptionistWorkflow?.state, "BOOKING_CHECK_AVAILABILITY");

const feedback = parseToolFeedbackFromModel(
  "TOOL_FEEDBACK: success\nnext_action: end_call\nguidance: done\ncaller_already_heard_success: true",
);
assert.ok(feedback);
activateBookingWorkflow(ud);
transitionFromToolFeedback(ud, "schedule_appointment", feedback!);
assert.equal(ud.receptionistWorkflow?.state, "BOOKING_DONE");
assert.equal(ud.receptionistWorkflow?.speechLocked, true);

const allowed = allowedToolNamesForWorkflow(ud, ud.receptionistToolNames!);
assert.ok(allowed.has("end_call"));
assert.ok(!allowed.has("schedule_appointment"));

assert.equal(bookingFieldsComplete(ud), true);

console.log("✓ receptionist workflow engine tests passed");
