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
} from "../src/lib/voice/workflow-runtime";

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
) {
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: workflow.version,
    legacyState,
    collectedFields: collected,
  });
  return compileTurnCapabilityEnvelope({ workflow, state: snapshot });
}

console.log("Workflow runtime compiler tests\n");

check("appointment workflow validates", validateWorkflowDefinition(APPOINTMENT_BOOKING_WORKFLOW_V1).length === 0);
check("message workflow validates", validateWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V1).length === 0);
check("message v2 validates", validateWorkflowDefinition(MESSAGE_TAKING_WORKFLOW_V2).length === 0);

const collecting = envelopeTools(APPOINTMENT_BOOKING_WORKFLOW_V1, "COLLECTING_FIELDS", {});
check(
  "collecting exposes record + check_availability for same-turn chain",
  collecting.toolNames.includes("record_current_field") &&
    collecting.toolNames.includes("check_availability"),
  collecting.toolNames.join(", "),
);
check(
  "collecting does NOT expose confirm_booking",
  !collecting.toolNames.includes("confirm_booking"),
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

const msgCollect = envelopeTools(MESSAGE_TAKING_WORKFLOW_V1, "COLLECTING_FIELDS", {});
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

console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
if (failures.length) {
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}
