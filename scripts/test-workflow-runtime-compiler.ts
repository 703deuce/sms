#!/usr/bin/env npx tsx
/**
 * Workflow runtime compiler tests — envelope, validation, workflow swapping.
 * Run: npm run test:workflow-runtime-compiler
 */
import {
  APPOINTMENT_BOOKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V2,
  compileTurnCapabilityEnvelope,
  validateWorkflowDefinition,
  buildRuntimeSnapshotFromSession,
  resolveActiveWorkflowForAgent,
  setActiveWorkflowForAgent,
  compileArchitectDraftToWorkflowDefinition,
  resolveNextNodeId,
  linearVoiceNodePath,
} from "../src/lib/voice/workflow-runtime";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import { architectWorkflowFromRequest } from "../src/lib/agents/appointment-booking/workflow-architect";
import { normalizeSpokenEmail } from "../src/lib/voice/field-runtime/validate";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

function envelopeTools(
  workflow: typeof APPOINTMENT_BOOKING_WORKFLOW_V1,
  legacyState: string,
  collected: Record<string, string>,
  flags?: Record<string, unknown>,
) {
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: workflow.version,
    legacyState,
    collectedFields: collected,
    flags,
  });
  return compileTurnCapabilityEnvelope({ workflow, state: snapshot });
}

console.log("Workflow runtime compiler tests\n");

check("appointment workflow validates", validateWorkflowDefinition(APPOINTMENT_BOOKING_WORKFLOW_V1).length === 0);
check("message workflow validates", validateWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V1).length === 0);
check("message v2 validates", validateWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V2).length === 0);

const collectingIncomplete = envelopeTools(APPOINTMENT_BOOKING_WORKFLOW_V1, "COLLECTING_FIELDS", {}, {
  missingFieldCount: 2,
});
check(
  "collecting with missing fields exposes record only (no availability)",
  collectingIncomplete.toolNames.includes("record_current_field") &&
    !collectingIncomplete.toolNames.includes("check_availability"),
  collectingIncomplete.toolNames.join(", "),
);

const collectingComplete = envelopeTools(
  APPOINTMENT_BOOKING_WORKFLOW_V1,
  "COLLECTING_FIELDS",
  {
    fld_problem: "clogged drain",
    sys_name: "Anthony",
    sys_email: "anthony@example.com",
    sys_phone: "+15714776175",
  },
  { missingFieldCount: 0 },
);
check(
  "collecting complete exposes check_availability for same-turn chain",
  collectingComplete.toolNames.includes("check_availability"),
  collectingComplete.toolNames.join(", "),
);
check(
  "collecting does NOT expose confirm_booking",
  !collectingComplete.toolNames.includes("confirm_booking"),
);

const selecting = envelopeTools(APPOINTMENT_BOOKING_WORKFLOW_V1, "SELECTING_SLOT", {
  service_needed: "cleaning",
});
check(
  "selecting exposes select_slot",
  selecting.toolNames.includes("select_slot"),
  selecting.toolNames.join(", "),
);
check(
  "selecting stops at user boundary",
  selecting.stoppedAtUserBoundary === true,
);

const confirming = envelopeTools(APPOINTMENT_BOOKING_WORKFLOW_V1, "READY_TO_BOOK", {
  service_needed: "cleaning",
});
check(
  "confirming exposes confirm_booking",
  confirming.toolNames.includes("confirm_booking"),
  confirming.toolNames.join(", "),
);

const confirmAlwaysCaptures = envelopeTools(APPOINTMENT_BOOKING_WORKFLOW_V1, "READY_TO_BOOK", {
  service_needed: "cleaning",
});
check(
  "confirm node always exposes record_current_field for late email",
  confirmAlwaysCaptures.toolNames.includes("record_current_field"),
  confirmAlwaysCaptures.toolNames.join(", "),
);

const msgCollect = envelopeTools(MESSAGE_TAKING_WORKFLOW_V1, "COLLECTING_FIELDS", {}, {
  missingFieldCount: 2,
});
check(
  "message workflow exposes take_message path tools",
  msgCollect.toolNames.includes("record_current_field"),
  msgCollect.toolNames.join(", "),
);
check(
  "message workflow does NOT expose check_availability",
  !msgCollect.toolNames.includes("check_availability"),
);

const msgComplete = envelopeTools(MESSAGE_TAKING_WORKFLOW_V1, "COLLECTING_FIELDS", {
  caller_name: "Anthony",
  callback_number: "+14155550123",
  message: "Need a callback",
});
check(
  "message complete fields chain includes take_message",
  msgComplete.toolNames.includes("take_message"),
  msgComplete.toolNames.join(", "),
);

check(
  "message v2 has more fields than v1",
  (MESSAGE_TAKING_WORKFLOW_V2.nodes[0].fields?.length || 0) >
    (MESSAGE_TAKING_WORKFLOW_V1.nodes[0].fields?.length || 0),
);

setActiveWorkflowForAgent("test-agent", { workflowId: "message_taking", version: 1 });
const active = resolveActiveWorkflowForAgent("test-agent");
check("agent workflow swap to message", active.definition.id === "message_taking");

const authoritative = buildRuntimeSnapshotFromSession({
  workflow: APPOINTMENT_BOOKING_WORKFLOW_V1,
  workflowVersion: 1,
  legacyState: "COLLECTING_FIELDS",
  currentNodeId: "select_slot",
  collectedFields: {},
});
check(
  "authoritative currentNodeId overrides legacy state",
  authoritative.currentNodeId === "select_slot",
);

const draft = architectWorkflowFromRequest({
  agentId: "agent-test",
  userRequest: "Book appointments during business hours",
});
const compiled = compileArchitectDraftToWorkflowDefinition(draft);
check("architect draft compiles to workflow definition", compiled.nodes.length >= 4);
check(
  "compiled booking workflow includes check_availability node",
  compiled.nodes.some((n) => n.id === "check_availability"),
);

const bookingPath = linearVoiceNodePath(APPOINTMENT_BOOKING_WORKFLOW_V1);
check(
  "linear voice path starts at collect_fields",
  bookingPath[0] === "collect_fields",
);

const nextAfterFields = resolveNextNodeId({
  workflow: APPOINTMENT_BOOKING_WORKFLOW_V1,
  currentNodeId: "collect_fields",
  toolName: "record_current_field",
  result: { ok: true },
  session: {
    missingFieldIds: [],
  } as unknown as Parameters<typeof resolveNextNodeId>[0]["session"],
});
check("fields complete transitions to check_availability", nextAfterFields === "check_availability");

const dispatcherFieldsComplete = envelopeTools(
  HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  "INTENT_DISCOVERY",
  {
    fld_problem: "AC not cooling",
    sys_name: "John Smith",
    sys_email: "john@example.com",
    sys_phone: "+15714776175",
  },
  { missingFieldCount: 0 },
);
check(
  "dispatcher INTENT_DISCOVERY + fields complete exposes check_availability",
  dispatcherFieldsComplete.toolNames.includes("check_availability"),
  dispatcherFieldsComplete.toolNames.join(", "),
);

const dispatcherRecordFromLookup = resolveNextNodeId({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  currentNodeId: "lookup_customer",
  toolName: "record_current_field",
  result: { ok: true },
  session: {
    missingFieldIds: [],
  } as unknown as Parameters<typeof resolveNextNodeId>[0]["session"],
});
check(
  "dispatcher record_current_field from lookup_customer advances to classify",
  dispatcherRecordFromLookup === "classify",
  dispatcherRecordFromLookup,
);

const confirmMissingEmail = buildRuntimeSnapshotFromSession({
  workflow: APPOINTMENT_BOOKING_WORKFLOW_V1,
  workflowVersion: 1,
  legacyState: "READY_TO_BOOK",
  currentNodeId: "confirm_booking",
  collectedFields: { service_needed: "cleaning" },
  flags: { missingFieldCount: 1 },
});
const missingFieldEnvelope = compileTurnCapabilityEnvelope({
  workflow: APPOINTMENT_BOOKING_WORKFLOW_V1,
  state: confirmMissingEmail,
});
check(
  "confirm with missing fields exposes record_current_field",
  missingFieldEnvelope.toolNames.includes("record_current_field"),
  missingFieldEnvelope.toolNames.join(", "),
);

check(
  "spoken email normalizes at/dot",
  normalizeSpokenEmail("Anthony at Yahoo dot com") === "anthony@yahoo.com",
);

console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
if (failures.length) {
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
