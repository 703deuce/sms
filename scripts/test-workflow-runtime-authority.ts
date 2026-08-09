#!/usr/bin/env npx tsx
/**
 * Workflow runtime authority tests — canonical state, invariants, loops, field extraction.
 * Run: npx tsx scripts/test-workflow-runtime-authority.ts
 */
import {
  buildCanonicalWorkflowState,
  reconcileCanonicalWorkflowState,
  expectedToolForNextAction,
} from "../src/lib/voice/workflow-runtime/canonical-state";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import {
  buildRuntimeSnapshotFromSession,
  compileTurnCapabilityEnvelope,
} from "../src/lib/voice/workflow-runtime/compile-turn-envelope";
import { filterConversationalTools } from "../src/lib/voice/workflow-runtime/tool-surface";
import { validateRuntimeInvariants } from "../src/lib/voice/workflow-runtime/runtime-invariants";
import {
  normalizeExtractedFields,
  inferFieldsFromUtterance,
  mergeExtractedFieldMaps,
} from "../src/lib/voice/workflow-runtime/field-extraction";
import {
  shouldBlockRepeatedToolCall,
  fingerprintToolCall,
  isNoProgressToolResult,
  recordToolCallHistory,
} from "../src/lib/voice/workflow-runtime/loop-detection";
import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";
import type { ToolCallRecord } from "../src/lib/voice/workflow-runtime/loop-detection";

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
    currentState: "INTENT_DISCOVERY",
    currentNodeId: "lookup_customer",
    collectedFields: {},
    missingFieldIds: ["fld_problem", "sys_name", "sys_email", "fld_service_address"],
    activeField: "fld_problem",
    fieldManifest: [
      {
        field_id: "fld_problem",
        label: "Problem",
        type: "text",
        required: true,
        collection_instruction: "What issue are you having?",
      },
      {
        field_id: "sys_name",
        label: "Name",
        type: "text",
        required: true,
        collection_instruction: "May I have your name?",
      },
      {
        field_id: "sys_email",
        label: "Email",
        type: "email",
        required: true,
        collection_instruction: "What email should we use?",
      },
      {
        field_id: "fld_service_address",
        label: "Service address",
        type: "address",
        required: true,
        collection_instruction: "What is the service address?",
      },
    ],
    runtime: { state: "INTENT_DISCOVERY", current_node_id: "lookup_customer" },
    ...overrides,
  } as AmyRealtimeSession;
}

console.log("Workflow runtime authority tests\n");

const incomplete = buildCanonicalWorkflowState({
  session: mockSession(),
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
});
check(
  "incomplete intake expects collect_caller_information",
  incomplete.expectedNextAction === "collect_caller_information",
  incomplete.expectedNextAction,
);
check(
  "legacy state derived from node",
  incomplete.legacyState === "INTENT_DISCOVERY",
  incomplete.legacyState,
);

const completeSession = mockSession({
  collectedFields: {
    fld_problem: "AC not cooling",
    sys_name: "John Smith",
    sys_email: "john@example.com",
    fld_service_address: "123 Main St",
  },
  missingFieldIds: [],
  activeField: null,
  currentNodeId: "lookup_customer",
});

const completeCanonical = buildCanonicalWorkflowState({
  session: completeSession,
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
});
check(
  "fields complete advances canonical node past lookup_customer",
  completeCanonical.currentNodeId === "classify",
  completeCanonical.currentNodeId,
);
check("fields complete ready for availability", completeCanonical.readyForAvailability);

const incompleteSnapshot = buildRuntimeSnapshotFromSession({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  workflowVersion: 1,
  legacyState: incomplete.legacyState,
  currentNodeId: incomplete.currentNodeId,
  collectedFields: {},
  flags: { missingFieldCount: incomplete.missingFieldIds.length },
});
const incompleteEnvelope = compileTurnCapabilityEnvelope({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  state: incompleteSnapshot,
});
const incompleteConversational = filterConversationalTools(incompleteEnvelope.toolNames);
check(
  "submit_caller_information exposed during intake",
  incompleteConversational.includes("submit_caller_information"),
  incompleteConversational.join(", "),
);

const snapshot = buildRuntimeSnapshotFromSession({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  workflowVersion: 1,
  legacyState: completeCanonical.legacyState,
  currentNodeId: completeCanonical.currentNodeId,
  collectedFields: completeSession.collectedFields,
  flags: { missingFieldCount: 0 },
});
const envelope = compileTurnCapabilityEnvelope({
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  state: snapshot,
});
const conversational = filterConversationalTools(envelope.toolNames);
check(
  "conversational tools include check_availability when fields complete",
  conversational.includes("check_availability"),
  conversational.join(", "),
);
check(
  "runtime-only tools hidden from conversational surface",
  !conversational.includes("get_booking_requirements") &&
    !conversational.includes("record_current_field"),
  conversational.join(", "),
);

const invariant = validateRuntimeInvariants({
  canonical: completeCanonical,
  envelope: { ...envelope, toolNames: conversational },
});
check("no invariant violation when tools match canonical next action", invariant.ok);

const staleCanonical = {
  ...completeCanonical,
  currentNodeId: "check_availability",
  legacyState: "CHECKING_AVAILABILITY" as const,
  expectedNextAction: "check_availability" as const,
};
const staleToolNames = conversational.filter((t) => t !== "check_availability");
const staleInvariant = validateRuntimeInvariants({
  canonical: staleCanonical,
  envelope: { ...envelope, toolNames: staleToolNames },
});
check(
  "stale early node triggers invariant violation",
  !staleInvariant.ok,
  staleInvariant.ok ? "unexpected ok" : staleInvariant.violation?.message,
);
check(
  "stale invariant expects check_availability",
  staleInvariant.violation?.expectedTool === "check_availability",
);

const extracted = normalizeExtractedFields({
  session: completeSession,
  extracted: {
    service_address: "456 Oak Avenue",
    name: "Jane Doe",
  },
});
check("field extraction maps aliases to manifest ids", extracted.fld_service_address === "456 Oak Avenue");
check("field extraction maps name alias", extracted.sys_name === "Jane Doe");

const inferred = inferFieldsFromUtterance({
  session: mockSession({ activeField: "fld_problem" }),
  utterance: "My AC stopped working",
});
check("utterance inference fills active field", inferred.fld_problem === "My AC stopped working");

const merged = mergeExtractedFieldMaps({ sys_email: "a@b.com" }, { sys_name: "Test" });
check("merged extraction maps combine", merged.sys_email && merged.sys_name);

const sessionForReconcile = mockSession({
  collectedFields: completeSession.collectedFields,
  missingFieldIds: [],
  currentNodeId: "lookup_customer",
});
reconcileCanonicalWorkflowState({
  session: sessionForReconcile,
  workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  toolName: "record_fields",
  toolResult: { ok: true },
});
check(
  "reconcile advances session node after field completion",
  sessionForReconcile.currentNodeId === "classify",
  sessionForReconcile.currentNodeId,
);
check(
  "reconcile syncs derived legacy state",
  sessionForReconcile.currentState !== "INTENT_DISCOVERY" ||
    sessionForReconcile.currentNodeId !== "lookup_customer",
);

const fp = fingerprintToolCall({
  toolName: "get_booking_requirements",
  nodeId: "lookup_customer",
  missingFieldCount: 0,
});
let history: ToolCallRecord[] = [];
for (let i = 0; i < 2; i++) {
  history = recordToolCallHistory(history, {
    toolName: "get_booking_requirements",
    fingerprint: fp,
    resultHash: "abc",
    atMs: Date.now(),
    noProgress: true,
  });
}
const loopBlock = shouldBlockRepeatedToolCall({
  history,
  toolName: "get_booking_requirements",
  fingerprint: fp,
});
check("loop detection blocks third identical no-progress call", loopBlock.blocked);
check("loop detection error code", loopBlock.code === "NO_PROGRESS_LOOP");

check(
  "no-progress detection for get_booking_requirements",
  isNoProgressToolResult({
    toolName: "get_booking_requirements",
    ok: true,
    beforeMissingCount: 0,
    afterMissingCount: 0,
    beforeNodeId: "lookup_customer",
    afterNodeId: "lookup_customer",
  }),
);

check(
  "expected tool for check_availability action",
  expectedToolForNextAction("check_availability") === "check_availability",
);

if (failures.length) {
  console.error(`\n${failures.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${failures.length === 0 ? "tests" : ""} passed.`);
