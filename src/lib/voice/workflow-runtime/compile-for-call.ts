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

export function compileToolsForCallContext(callContext: LiveKitCallContext): {
  workflow: WorkflowDefinition;
  envelope: TurnToolEnvelope;
  allowedToolNames: Set<string>;
} {
  const { definition: workflow, ref } = resolveActiveWorkflowForAgent(callContext.agentId);

  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: ref.version,
    legacyState: callContext.session.currentState,
    collectedFields: callContext.session.collectedFields || {},
    confirmationReceived: callContext.session.confirmationState === "confirmed",
    flags: {
      ...(callContext.workflowRuntime?.flags || {}),
      missingFieldCount: callContext.session.missingFieldIds?.length ?? 0,
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
