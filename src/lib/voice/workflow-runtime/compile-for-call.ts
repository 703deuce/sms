import {
  buildRuntimeSnapshotFromSession,
  compileTurnCapabilityEnvelope,
} from "./compile-turn-envelope";
import {
  stampEnvelopeCapabilities,
} from "./capability-guard";
import type { TurnToolEnvelope, WorkflowDefinition } from "./schema";
import { resolveActiveWorkflowForAgent } from "./loader";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions/session-bootstrap";
import type { CanonicalWorkflowState } from "./canonical-state";
import {
  reconcileCanonicalWorkflowState,
  syncSessionFromCanonical,
  expectedToolForNextAction,
} from "./canonical-state";
import { capabilityForToolName } from "@/lib/voice/capability-registry";
import { filterConversationalTools } from "./tool-surface";
import { validateRuntimeInvariants } from "./runtime-invariants";
import { requiresBookingReceiptToComplete } from "./completion-guards";

function isEmergencyClassification(
  classifications?: Record<string, string> | null,
): boolean {
  if (!classifications) return false;
  return (
    classifications.urgency === "emergency" || classifications.safety === "gas_smell"
  );
}

export function compileToolsForCallContext(callContext: LiveKitCallContext): {
  workflow: WorkflowDefinition;
  envelope: TurnToolEnvelope;
  allowedToolNames: Set<string>;
  canonical: CanonicalWorkflowState;
  invariantOk: boolean;
} {
  const resolved = resolveActiveWorkflowForAgent(callContext.agentId);
  const workflow = callContext.workflowDefinition || resolved.definition;
  const ref = callContext.workflowRef || resolved.ref;

  const canonical = reconcileCanonicalWorkflowState({
    session: callContext.session,
    workflow,
  });
  syncSessionFromCanonical({ session: callContext.session, workflow, canonical });
  callContext.workflowState = canonical.legacyState;

  const callerIntent =
    callContext.session.runtime.session_runtime?.callerIntent || null;
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: ref.version,
    legacyState: canonical.legacyState,
    currentNodeId: canonical.currentNodeId,
    collectedFields: callContext.session.collectedFields || {},
    confirmationReceived:
      callContext.session.confirmationState === "confirmed" ||
      Boolean(callContext.session.runtime.confirmation_received),
    flags: {
      ...(callContext.workflowRuntime?.flags || {}),
      missingFieldCount: canonical.missingFieldIds.length,
      expectedNextAction: canonical.expectedNextAction,
      readyForAvailability: canonical.readyForAvailability,
      emergency:
        isEmergencyClassification(
          callContext.session.runtime.session_runtime?.classifications,
        ) || callerIntent === "emergency",
      bookIntent:
        !callerIntent ||
        callerIntent === "book_service" ||
        callerIntent === "general_question" ||
        callerIntent === "unknown",
      rescheduleIntent: callerIntent === "reschedule",
      cancelIntent: callerIntent === "cancel",
    },
  });

  let envelope = compileTurnCapabilityEnvelope({ workflow, state: snapshot });

  const modifyFlow =
    callerIntent === "reschedule" || callerIntent === "cancel";
  const schedulingNodes = new Set([
    "reschedule_lookup",
    "cancel_lookup",
    "check_availability",
    "select_slot",
    "confirm_booking",
    "cancel_confirm",
  ]);
  if (modifyFlow && schedulingNodes.has(canonical.currentNodeId)) {
    envelope = {
      ...envelope,
      capabilityIds: envelope.capabilityIds.filter(
        (id) => id !== "data.capture" && id !== "data.lookup",
      ),
      toolNames: envelope.toolNames.filter(
        (name) => name !== "submit_caller_information" && name !== "get_booking_requirements",
      ),
    };
  }

  let conversationalToolNames = filterConversationalTools(envelope.toolNames).filter(
    (name) => {
      if (name !== "end_call") return true;
      return !requiresBookingReceiptToComplete(callContext.session);
    },
  );

  if (!canonical.readyForAvailability) {
    conversationalToolNames = conversationalToolNames.filter(
      (name) => name !== "check_availability",
    );
  }

  const expectedTool = expectedToolForNextAction(canonical.expectedNextAction);
  if (expectedTool && !conversationalToolNames.includes(expectedTool)) {
    conversationalToolNames = [...conversationalToolNames, expectedTool];
    const expectedCap = capabilityForToolName(expectedTool);
    if (expectedCap && !envelope.capabilityIds.includes(expectedCap.id)) {
      envelope = {
        ...envelope,
        capabilityIds: [...envelope.capabilityIds, expectedCap.id],
        toolNames: envelope.toolNames.includes(expectedTool)
          ? envelope.toolNames
          : [...envelope.toolNames, expectedTool],
      };
    }
  }
  const stampedEnvelope = stampEnvelopeCapabilities(snapshot, envelope.capabilityIds);
  const invariant = validateRuntimeInvariants({
    canonical,
    envelope: { ...envelope, toolNames: conversationalToolNames },
    allowRepair: true,
  });

  if (!invariant.ok) {
    console.error(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "runtime_invariant_violation",
        callId: callContext.callId,
        ...invariant.violation,
      }),
    );
  }

  callContext.workflowRef = ref;
  callContext.workflowRuntime = stampedEnvelope;
  callContext.lastToolEnvelope = envelope;
  callContext.canonicalWorkflow = canonical;

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "tool_envelope_compiled",
      callId: callContext.callId,
      workflowId: ref.workflowId,
      workflowVersion: ref.version,
      currentNodeId: canonical.currentNodeId,
      legacyState: canonical.legacyState,
      expectedNextAction: canonical.expectedNextAction,
      readyForAvailability: canonical.readyForAvailability,
      capabilityIds: envelope.capabilityIds,
      toolNames: conversationalToolNames,
      runtimeToolNames: envelope.toolNames.filter((t) => !conversationalToolNames.includes(t)),
      invariantOk: invariant.ok,
      stoppedAtUserBoundary: envelope.stoppedAtUserBoundary,
      stoppedAtNodeId: envelope.stoppedAtNodeId,
      visitedNodeIds: envelope.visitedNodeIds,
    }),
  );

  return {
    workflow,
    envelope,
    allowedToolNames: new Set(conversationalToolNames),
    canonical,
    invariantOk: invariant.ok,
  };
}
