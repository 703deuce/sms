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
} {
  const resolved = resolveActiveWorkflowForAgent(callContext.agentId);
  const workflow = callContext.workflowDefinition || resolved.definition;
  const ref = callContext.workflowRef || resolved.ref;

  const callerIntent =
    callContext.session.runtime.session_runtime?.callerIntent || null;
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: ref.version,
    legacyState: callContext.session.currentState,
    currentNodeId:
      callContext.session.currentNodeId ||
      callContext.session.runtime.current_node_id ||
      null,
    collectedFields: callContext.session.collectedFields || {},
    confirmationReceived:
      callContext.session.confirmationState === "confirmed" ||
      Boolean(callContext.session.runtime.confirmation_received),
    flags: {
      ...(callContext.workflowRuntime?.flags || {}),
      missingFieldCount: callContext.session.missingFieldIds?.length ?? 0,
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

  const envelope = compileTurnCapabilityEnvelope({ workflow, state: snapshot });
  const withEnvelope = stampEnvelopeCapabilities(snapshot, envelope.capabilityIds);

  callContext.workflowRef = ref;
  callContext.workflowRuntime = withEnvelope;
  callContext.lastToolEnvelope = envelope;

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "tool_envelope_compiled",
      callId: callContext.callId,
      workflowId: ref.workflowId,
      workflowVersion: ref.version,
      currentNodeId: snapshot.currentNodeId,
      capabilityIds: envelope.capabilityIds,
      toolNames: envelope.toolNames,
      stoppedAtUserBoundary: envelope.stoppedAtUserBoundary,
      stoppedAtNodeId: envelope.stoppedAtNodeId,
      visitedNodeIds: envelope.visitedNodeIds,
    }),
  );

  return {
    workflow,
    envelope,
    allowedToolNames: new Set(envelope.toolNames),
  };
}
