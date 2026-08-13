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
assert.ok(fieldTask.includes("addToChatCtx: false"), "collection speech must not enter chat_ctx");
assert.ok(
  fieldTask.includes("preserveFunctionCallHistory: false") ||
    fieldTask.includes("receptionistOperationalTaskOptionsFromSession"),
  "must not preserve child function-call history into parent",
);

const ud = {
  callId: "test-call",
  workspaceId: "ws",
  agentId: "agent",
  businessName: "Test",
  timezone: "America/New_York",
  cal: {} as FrontDeskUserData["cal"],
  slotUnavailableCount: 0,
  receptionistFields: {
    name: "Anthony Johnson",
    phone: "571-477-6175",
    address: "13327 Kirkdale Court, Woodbridge, Virginia 22193",
  },
} satisfies Partial<FrontDeskUserData> as FrontDeskUserData;

const result: ReceptionistFieldCollectionResult = {
  collected: ["name", "phone", "address"],
  complete: true,
  fields: ud.receptionistFields!,
};

const toolResult = buildReceptionistCollectionToolResult(ud, result);
assert.ok(toolResult.startsWith("COLLECTION_COMPLETE:"), toolResult);
assert.ok(toolResult.includes("name=Anthony Johnson"), toolResult);
assert.ok(toolResult.includes("address=13327"), toolResult);
assert.ok(toolResult.includes("Do not thank again"), toolResult);
assert.equal(ud.receptionistFieldCollectionComplete, true);
assert.equal(ud.receptionistFieldsAcknowledged, true);

console.log("test-receptionist-field-handoff: ok");
