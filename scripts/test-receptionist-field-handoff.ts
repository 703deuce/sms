/**
 * Acceptance contract: receptionist field collection handoff must not duplicate
 * field acknowledgments at the parent boundary.
 *
 * Run: npx tsx scripts/test-receptionist-field-handoff.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildReceptionistCollectionToolResult } from "../voice-runtime/src/frontdesk/receptionist/field-collection-lifecycle";
import type { ReceptionistFieldCollectionResult } from "../voice-runtime/src/frontdesk/receptionist/field-collection-task";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const fieldTask = read("voice-runtime/src/frontdesk/receptionist/field-collection-task.ts");
assert.ok(
  fieldTask.includes("addToChatCtx: options?.addToChatCtx ?? true"),
  "collection speech should default into parent chat_ctx for one conversational brain",
);
assert.ok(
  fieldTask.includes("preserveFunctionCallHistory: false") ||
    fieldTask.includes("receptionistOperationalTaskOptionsFromSession"),
  "legacy field task must not preserve child function-call history into parent",
);

const receptionistTools = read("voice-runtime/src/frontdesk/receptionist/receptionist-tools.ts");
assert.ok(
  receptionistTools.includes("record_current_field"),
  "runtime-owned record_current_field is the single collection path",
);
assert.ok(
  receptionistTools.includes("when they ask for a text confirmation"),
  "send_sms tool must invite explicit text requests",
);

const bookingTools = read("voice-runtime/src/frontdesk/booking-tools.ts");
assert.ok(
  bookingTools.includes("sendBookingSmsAsync"),
  "booking success queues SMS async after speaking confirmation",
);
assert.ok(
  !bookingTools.includes("await sendBookingConfirmationSms"),
  "must not block caller audio on SMS send",
);
assert.ok(
  fieldTask.includes("record_additional_caller_field"),
  "legacy field task still supports unordered multi-field answers",
);
assert.ok(
  !receptionistTools.includes("runBookingIntakeTask"),
  "receptionist must not route booking to autonomous BookingIntakeTask",
);
assert.ok(
  receptionistTools.includes("record_receptionist_field"),
  "supervisor must persist volunteered fields without task handoff",
);

const ud = {
  callId: "test-call",
  receptionistFields: { name: "Jane", phone: "+14045551212" },
  receptionistFieldCollectionComplete: false,
  receptionistFieldsAcknowledged: false,
} as FrontDeskUserData;

const result: ReceptionistFieldCollectionResult = {
  collected: ["name", "phone"],
  complete: true,
  fields: { name: "Jane", phone: "+14045551212" },
};

const toolResult = buildReceptionistCollectionToolResult(ud, result);
assert.ok(toolResult.startsWith("TOOL_FEEDBACK: success"), toolResult);
assert.ok(
  toolResult.includes("do not reconfirm") || toolResult.includes("Do not thank again"),
  "parent must not re-acknowledge collected fields",
);

console.log("receptionist field handoff contract: PASS");
