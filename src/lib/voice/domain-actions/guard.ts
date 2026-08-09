import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { authorizeCapabilityInvocation } from "@/lib/voice/workflow-runtime/capability-guard";
import { buildRuntimeSnapshotFromSession } from "@/lib/voice/workflow-runtime/compile-turn-envelope";
import { resolveActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import { assertTaskToolAllowed, taskForWorkflowState } from "./task-guard";

/** Shared capability guard for all domain actions. */
export function guardToolInvocation(
  ctx: LiveKitCallContext,
  toolName: string,
): DomainActionResult | null {
  const { definition: workflow, ref } = resolveActiveWorkflowForAgent(ctx.agentId);
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: ref.version,
    legacyState: ctx.session.currentState,
    currentNodeId:
      ctx.session.currentNodeId || ctx.session.runtime.current_node_id || null,
    collectedFields: ctx.session.collectedFields || {},
    confirmationReceived:
      ctx.session.confirmationState === "confirmed" ||
      Boolean(ctx.session.runtime.confirmation_received),
    flags: {
      ...(ctx.workflowRuntime?.flags || {}),
      _envelopeCapabilities: ctx.lastToolEnvelope?.capabilityIds,
    },
  });
  const guard = authorizeCapabilityInvocation({ workflow, state: snapshot, toolName });
  if (guard.ok) {
    try {
      const taskId = taskForWorkflowState(ctx.session.currentState);
      assertTaskToolAllowed(taskId, toolName);
    } catch {
      // task-guard is defense-in-depth; capability guard is authoritative during migration
    }
    return null;
  }
  return {
    ok: false,
    speak: guard.speak,
    error_code: guard.error_code,
    workflow_state: ctx.session.currentState,
  };
}
