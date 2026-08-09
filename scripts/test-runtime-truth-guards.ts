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
import { normalizeExtractedFields } from "../src/lib/voice/workflow-runtime/field-extraction";
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

const heldMissingAddress = mockSession({
  collectedFields: { sys_email: "a@b.com" },
  availableSlots: ["2026-08-11T13:30:00.000Z"],
  heldSlot: "2026-08-11T13:30:00.000Z",
  missingFieldIds: ["fld_service_address"],
});
const heldMissingCanonical = buildCanonicalWorkflowState({
  session: heldMissingAddress,
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
});
check(
  "held slot with missing address still → confirm_booking",
  heldMissingCanonical.currentNodeId === "confirm_booking",
  heldMissingCanonical.currentNodeId,
);
check(
  "held slot with missing address expects confirm_booking tool",
  heldMissingCanonical.expectedNextAction === "confirm_booking",
);

const nextAfterLateSubmit = resolveNextNodeId({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  currentNodeId: "select_slot",
  toolName: "submit_caller_information",
  result: { ok: true },
  session: heldMissingAddress,
});
check(
  "late submit with held slot stays at confirm_booking",
  nextAfterLateSubmit === "confirm_booking",
  nextAfterLateSubmit,
);

const addrMapped = normalizeExtractedFields({
  session: mockSession(),
  extracted: { addr: "11146 Sunburst Lane, Fredericksburg VA" },
});
check(
  "addr alias maps to service address field",
  addrMapped.fld_service_address === "11146 Sunburst Lane, Fredericksburg VA",
  JSON.stringify(addrMapped),
);

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

const rescheduleSession = mockSession({
  currentNodeId: "detect_intent",
  missingFieldIds: ["sys_email", "sys_name"],
  runtime: {
    state: "INTENT_DISCOVERY",
    current_node_id: "detect_intent",
    session_runtime: { callerIntent: "reschedule" },
  },
} as Partial<AmyRealtimeSession>);
check(
  "fresh call with missing fields stays at detect_intent",
  deriveAuthoritativeNodeId({
    session: mockSession({
      currentNodeId: "detect_intent",
      missingFieldIds: ["sys_email", "sys_name"],
      runtime: { state: "INTENT_DISCOVERY", current_node_id: "detect_intent" },
    } as Partial<AmyRealtimeSession>),
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    storedNodeId: "detect_intent",
  }) === "detect_intent",
);
check(
  "reschedule intent routes to reschedule_lookup despite missing fields",
  deriveAuthoritativeNodeId({
    session: rescheduleSession,
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    storedNodeId: "reschedule_lookup",
  }) === "reschedule_lookup",
);
check(
  "reschedule intent with stored detect_intent advances to reschedule_lookup",
  deriveAuthoritativeNodeId({
    session: rescheduleSession,
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    storedNodeId: "detect_intent",
  }) === "reschedule_lookup",
);

const cancelSession = mockSession({
  currentNodeId: "cancel_lookup",
  runtime: {
    state: "GENERAL",
    current_node_id: "cancel_lookup",
    session_runtime: { callerIntent: "cancel" },
  },
} as Partial<AmyRealtimeSession>);
check(
  "cancel intent routes to cancel_lookup despite missing fields",
  deriveAuthoritativeNodeId({
    session: cancelSession,
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    storedNodeId: "cancel_lookup",
  }) === "cancel_lookup",
);

import { readFileSync } from "node:fs";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { buildSimulatorWizardState } from "../src/lib/voice/testing/frontend-agent-seed";
import { getScenario } from "../src/lib/voice/testing/conversation-scenarios";

const phoneFirstState = buildSimulatorWizardState({
  scenario: getScenario("garbage-disposal-phone-first"),
  agentId: "agent-sim",
  phoneNumberE164: "+14155550198",
});
const phoneFirstConfig = buildWizardAgentConfig(phoneFirstState);
const bookingSection = phoneFirstConfig.conversationFlow?.sections?.find(
  (section) => section.type === "booking",
);
const wizardCollectFields = (
  bookingSection?.config as { collectFields?: Array<{ id: string; enabled?: boolean }> } | undefined
)?.collectFields;
check(
  "frontend wizard seed writes collectFields on booking section",
  Array.isArray(wizardCollectFields) && wizardCollectFields.length >= 4,
);
check(
  "phone-first profile disables email in draftConfig",
  wizardCollectFields?.find((field) => field.id === "email")?.enabled === false,
);

const availabilitySource = readFileSync(
  "src/lib/voice/scheduling-domain/availability.ts",
  "utf8",
);
const bookingActionsSource = readFileSync(
  "src/lib/voice/domain-actions/booking-actions.ts",
  "utf8",
);
check(
  "production availability passes callId to executeAgentTool",
  availabilitySource.includes("callId: query.callId"),
);
check(
  "production check_availability passes ctx.callId into availability lookup",
  bookingActionsSource.includes("callId: input.ctx.callId"),
);

if (failures.length) {
  console.error(`\n${failures.length} test(s) failed`);
  process.exit(1);
}
console.log("\nAll tests passed.");
