/**
 * Intent detection + activation contracts.
 * Run: npx tsx scripts/test-workflow-intent-activation.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { detectWorkflowIntentFromUtterance } from "../voice-runtime/src/frontdesk/receptionist/workflow-intent-detection";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

assert.equal(detectWorkflowIntentFromUtterance("I'd like to book an appointment"), "booking");
assert.equal(detectWorkflowIntentFromUtterance("Can someone call me back?"), "message");
assert.equal(detectWorkflowIntentFromUtterance("I need to speak to a person"), "transfer");
assert.equal(detectWorkflowIntentFromUtterance("thanks"), null);

const receptionistTools = read("voice-runtime/src/frontdesk/receptionist/receptionist-tools.ts");
assert.ok(receptionistTools.includes("set_workflow_intent"), "set_workflow_intent tool exists");
assert.ok(!receptionistTools.includes("record_receptionist_field"), "no duplicate field tool");

const orchestrator = read("voice-runtime/src/frontdesk/receptionist/workflow-orchestrator.ts");
assert.ok(orchestrator.includes("BOOKING_FAILED"), "booking failure state handled");
assert.ok(orchestrator.includes("runtimeFinalizeBookingFailure"), "failure speech lock");

console.log("✓ workflow intent activation tests passed");
