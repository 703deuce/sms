/**
 * Tool result normalization tests.
 * Run: npx tsx scripts/test-tool-feedback-normalize.ts
 */
import assert from "node:assert/strict";
import {
  formatToolFeedbackForModel,
  normalizeToolResultForModel,
  toolFeedbackSuccess,
  TOOL_RESULT_BOOKING_INTAKE_SILENT,
  TOOL_RESULT_COLLECT_ACTIVE_SILENT,
} from "../src/lib/voice/tool-feedback";

const alreadyFormatted = formatToolFeedbackForModel(
  toolFeedbackSuccess("Done.", { tool: "take_message" }),
);
assert.equal(normalizeToolResultForModel("take_message", alreadyFormatted), alreadyFormatted);

const collection = normalizeToolResultForModel(
  "collect_caller_fields",
  "COLLECTION_COMPLETE: name=Jane. Continue with booking.",
);
assert.match(collection, /^TOOL_FEEDBACK: success/);
assert.match(collection, /next_action: continue_conversation/);

const collectionSchedule = normalizeToolResultForModel(
  "collect_caller_fields",
  "COLLECTION_COMPLETE: name=Jane. Call schedule_appointment with slot_id ST_abc.",
);
assert.match(collectionSchedule, /next_action: schedule_appointment_retry/);

const intake = normalizeToolResultForModel(
  "collect_booking_requirements",
  "BOOKING_INTAKE_COMPLETE: email=test@example.com. Call schedule_appointment.",
);
assert.match(intake, /^TOOL_FEEDBACK: success/);
assert.match(intake, /next_action: schedule_appointment_retry/);

const silentCollect = normalizeToolResultForModel(
  "collect_caller_fields",
  TOOL_RESULT_COLLECT_ACTIVE_SILENT,
);
assert.match(silentCollect, /^TOOL_FEEDBACK: success/);
assert.match(silentCollect, /next_action: do_not_speak/);

const silentIntake = normalizeToolResultForModel(
  "collect_booking_requirements",
  TOOL_RESULT_BOOKING_INTAKE_SILENT,
);
assert.match(silentIntake, /next_action: do_not_speak/);

const plain = normalizeToolResultForModel(
  "take_message",
  "Message recorded. Tell the caller someone will follow up.",
);
assert.match(plain, /^TOOL_FEEDBACK: success/);
assert.match(plain, /next_action: continue_conversation/);

const redirect = normalizeToolResultForModel(
  "collect_caller_fields",
  "Use take_message for callback requests — do not run field collection.",
);
assert.match(redirect, /^TOOL_FEEDBACK: recoverable_failure/);

console.log("tool feedback normalize tests: PASS");
