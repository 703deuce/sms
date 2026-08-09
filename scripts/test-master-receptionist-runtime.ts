#!/usr/bin/env npx tsx
/**
 * Master receptionist runtime tests — all phases.
 * Run: npm run test:master-receptionist-runtime
 */
import { validateServiceArea } from "../src/lib/voice/eligibility/validate";
import {
  evaluateQualificationRules,
  inferClassifications,
} from "../src/lib/voice/rules-engine/evaluate";
import {
  applyTransferEvent,
  initialTransferState,
  transferRequiresRecovery,
} from "../src/lib/voice/transfer-state/machine";
import { filterEligibleResources } from "../src/lib/voice/scheduling-domain/availability";
import type { SchedulingResource, SchedulingService } from "../src/lib/voice/scheduling-domain/types";
import { getToolPolicy, isToolAllowedForTask } from "../src/lib/voice/tool-policy/registry";
import { toStructuredResult } from "../src/lib/voice/tool-policy/structured-result";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import { assertValidWorkflowDefinition } from "../src/lib/voice/workflow-runtime/validator";
import { compileTurnCapabilityEnvelope } from "../src/lib/voice/workflow-runtime/compile-turn-envelope";
import { shouldReuseHold } from "../src/lib/voice/session-runtime/state";
import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";
import { emptyAgentRuntime } from "../src/lib/voice/workflow-engine/runtime-state";

const failures: string[] = [];
let testsRun = 0;

function check(name: string, cond: boolean, detail?: string) {
  testsRun++;
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

function mockSession(overrides: Partial<AmyRealtimeSession> = {}): AmyRealtimeSession {
  const runtime = emptyAgentRuntime("book_appointment");
  return {
    sessionId: "sess_test",
    callId: "call_test",
    telnyxConversationId: null,
    telnyxControlId: null,
    agentId: "agent_test",
    workspaceId: "ws_test",
    workflowId: "book_appointment",
    currentState: "COLLECTING_FIELDS",
    collectedFields: {},
    activeField: null,
    missingFieldIds: [],
    lastIntent: null,
    lastUserUtterance: null,
    pendingOperation: null,
    lastRuntimeResult: null,
    availableSlots: [],
    heldSlot: null,
    selectedSlot: null,
    confirmationState: "none",
    contactId: null,
    callerAni: "+15555550100",
    serviceName: "HVAC Repair",
    bookingId: null,
    voiceWorkflowId: "home_service_dispatcher",
    voiceWorkflowVersion: 1,
    currentNodeId: "collect_fields",
    runtime,
    fieldManifest: [],
    timezone: "America/New_York",
    version: 1,
    configHash: "test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function main() {
  console.log("Master receptionist runtime tests\n");

  // Phase 0: structured results + tool policy
  const policy = getToolPolicy("confirm_booking");
  check("tool policy exists for confirm_booking", Boolean(policy));
  check(
    "confirm_booking requires confirmation",
    policy?.confirmationRequirement === "required_before_execute",
  );
  check(
    "lookup allowed in CollectRequiredFieldsTask",
    isToolAllowedForTask("lookup_customer", "CollectRequiredFieldsTask"),
  );
  const structured = toStructuredResult({
    ok: false,
    speak: "Need fields",
    error_code: "MISSING_FIELDS",
  });
  check("structured result maps error code", structured.code === "MISSING_FIELDS");

  // Phase 2: multi-resource filtering
  const service: SchedulingService = {
    id: "svc_1",
    name: "HVAC Repair",
    durationMinutes: 90,
    requiredSkills: ["hvac_repair"],
    eligibleResourceIds: ["tech_a", "tech_b", "tech_c"],
  };
  const resources: SchedulingResource[] = [
    { id: "tech_a", name: "Technician A", skills: ["hvac_repair"], zones: ["zone_a"] },
    { id: "tech_b", name: "Technician B", skills: ["hvac_repair"], zones: ["zone_a", "zone_b"] },
    { id: "tech_c", name: "Technician C", skills: ["install_only"], zones: ["zone_b"] },
  ];
  const eligible = filterEligibleResources({ service, resources, zone: "zone_b" });
  check("multi-resource filters by skill", eligible.length === 1 && eligible[0]?.id === "tech_b");
  check(
    "install-only tech excluded",
    !eligible.some((r) => r.id === "tech_c"),
  );

  // Phase 3: eligibility + classification
  const inArea = validateServiceArea({
    address: "421 Main Street, Fredericksburg, VA 22401",
    config: { zipCodes: ["22401"], cities: ["Fredericksburg"] },
  });
  check("service area in-area", inArea.status === "in_area");

  const outArea = validateServiceArea({
    address: "999 Far Away, Richmond, VA 23220",
    config: { zipCodes: ["22401"], cities: ["Fredericksburg"] },
  });
  check("service area out-of-area", outArea.status === "out_of_area");

  const classifications = inferClassifications({
    collectedFields: { fld_problem: "gas smell near furnace" },
    utterance: "there is a strong gas smell",
  });
  check("gas smell classified emergency", classifications.safety === "gas_smell");
  check("urgency emergency for gas", classifications.urgency === "emergency");

  const rules = (HOME_SERVICE_DISPATCHER_WORKFLOW_V1.metadata?.qualificationRules || []) as Array<{
    id: string;
    when: { classification: string; equals: string };
    then: { action: string };
  }>;
  const ruleResult = evaluateQualificationRules(rules, {
    classifications,
    collectedFields: {},
  });
  check("gas rule triggers transfer", ruleResult.primaryAction?.action === "transfer");

  // Phase 4: transfer state machine
  let transfer = initialTransferState();
  transfer = applyTransferEvent(transfer, {
    type: "request",
    destination: "+15555550100",
  });
  transfer = applyTransferEvent(transfer, { type: "dialing" });
  transfer = applyTransferEvent(transfer, { type: "no_answer" });
  transfer = applyTransferEvent(transfer, {
    type: "returned_to_agent",
    fallbackAction: "take_message",
  });
  check("transfer no-answer recovery", transferRequiresRecovery(transfer));
  check("transfer ends in returned_to_agent", transfer.phase === "returned_to_agent");

  // Hold reuse
  const heldSession = mockSession({
    heldSlot: "2026-08-10T13:00:00.000Z",
    runtime: {
      ...emptyAgentRuntime("book_appointment"),
      session_runtime: {
        heldReservation: {
          holdId: "hold_1",
          serviceName: "HVAC Repair",
          start: "2026-08-10T13:00:00.000Z",
          status: "held",
          idempotencyKey: "k1",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    },
  });
  check(
    "should reuse valid hold",
    Boolean(shouldReuseHold(heldSession, "2026-08-10T13:00:00.000Z")),
  );

  // Phase 6: workflow validation + envelope
  check("home_service_dispatcher validates", (() => {
    try {
      assertValidWorkflowDefinition(HOME_SERVICE_DISPATCHER_WORKFLOW_V1);
      return true;
    } catch {
      return false;
    }
  })());

  const envelope = compileTurnCapabilityEnvelope({
    workflow: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    state: {
      workflowId: "home_service_dispatcher",
      workflowVersion: 1,
      currentNodeId: "collect_fields",
      collectedFields: {},
      confirmationReceived: false,
      flags: { missingFieldCount: 2 },
    },
  });
  check(
    "dispatcher collect node exposes record_fields",
    envelope.toolNames.includes("record_fields") || envelope.toolNames.includes("record_current_field"),
  );

  console.log(`\n${testsRun} tests, ${failures.length} failures`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
