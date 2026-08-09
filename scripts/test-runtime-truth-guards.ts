#!/usr/bin/env npx tsx
/**
 * Runtime truth guard tests — authoritative node, receipts, end_call guards.
 */
import {
  buildCanonicalWorkflowState,
  deriveAuthoritativeNodeId,
} from "../src/lib/voice/workflow-runtime/canonical-state";
import { resolveNextNodeId } from "../src/lib/voice/workflow-runtime/node-transitions";
import {
  hasBookingReceipt,
  requiresBookingReceiptToComplete,
} from "../src/lib/voice/workflow-runtime/completion-guards";
import { prepareFieldsForPersistence } from "../src/lib/voice/workflow-runtime/field-persist";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

function mockSession(overrides: Partial<AmyRealtimeSession> = {}): AmyRealtimeSession {
  return {
    callId: "call-test",
    sessionId: "sess-test",
    workspaceId: "ws-test",
    agentId: "agent-test",
    workflowId: "book_appointment",
    currentState: "COLLECTING_FIELDS",
    currentNodeId: "classify",
    collectedFields: {},
    missingFieldIds: [],
    activeField: null,
    fieldManifest: [
      {
        field_id: "sys_email",
        label: "Email",
        type: "email",
        required: true,
        collection_instruction: "Email?",
      },
      {
        field_id: "fld_service_address",
        label: "Address",
        type: "address",
        required: true,
        collection_instruction: "Address?",
      },
    ],
    availableSlots: [],
    heldSlot: null,
    selectedSlot: null,
    bookingId: null,
    runtime: { state: "COLLECTING_FIELDS", current_node_id: "classify" },
    ...overrides,
  } as AmyRealtimeSession;
}

console.log("Runtime truth guard tests\n");

const withSlots = mockSession({
  collectedFields: { sys_email: "a@b.com", fld_service_address: "123 Main" },
  availableSlots: ["2026-08-11T13:30:00.000Z", "2026-08-11T14:00:00.000Z"],
});
check(
  "slots without held cursor → select_slot",
  deriveAuthoritativeNodeId({
    session: withSlots,
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    storedNodeId: "classify",
  }) === "select_slot",
);

const withHeld = mockSession({
  collectedFields: { sys_email: "a@b.com", fld_service_address: "123 Main" },
  availableSlots: ["2026-08-11T13:30:00.000Z"],
  heldSlot: "2026-08-11T13:30:00.000Z",
});
const heldCanonical = buildCanonicalWorkflowState({
  session: withHeld,
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
});
check("held slot → confirm_booking node", heldCanonical.currentNodeId === "confirm_booking");
check("held slot expects confirm_booking action", heldCanonical.expectedNextAction === "confirm_booking");

const nextAfterSelect = resolveNextNodeId({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  currentNodeId: "classify",
  toolName: "select_slot",
  result: { ok: true },
  session: withHeld,
});
check("select_slot advances to confirm_booking from stale classify", nextAfterSelect === "confirm_booking");

check(
  "booking in progress blocks completion without receipt",
  requiresBookingReceiptToComplete(withHeld),
);
check("booking receipt clears guard", !requiresBookingReceiptToComplete(
  mockSession({ ...withHeld, bookingId: "appt-123", confirmationState: "confirmed" }),
));
check("has booking receipt", hasBookingReceipt(
  mockSession({ bookingId: "appt-123" }),
));

const emailPrep = prepareFieldsForPersistence({
  session: mockSession(),
  extracted: { sys_email: "anthony at g mail dot com" },
});
check(
  "spoken email normalized before persist",
  emailPrep.fields.sys_email === "anthony@gmail.com",
  emailPrep.fields.sys_email,
);

if (failures.length) {
  console.error(`\n${failures.length} test(s) failed`);
  process.exit(1);
}
console.log("\nAll tests passed.");
