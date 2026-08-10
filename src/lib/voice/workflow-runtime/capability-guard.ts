import { capabilityForToolName } from "@/lib/voice/capability-registry";
import type { WorkflowDefinition, WorkflowNode, WorkflowRuntimeSnapshot } from "./schema";

export type CapabilityGuardResult =
  | { ok: true }
  | { ok: false; speak: string; error_code: string };

/**
 * Authorize a tool invocation against the workflow graph and runtime state.
 * Tool visibility (envelope) is NOT authorization.
 */
export function authorizeCapabilityInvocation(input: {
  workflow: WorkflowDefinition;
  state: WorkflowRuntimeSnapshot;
  toolName: string;
}): CapabilityGuardResult {
  const cap = capabilityForToolName(input.toolName);
  if (!cap) {
    return {
      ok: false,
      speak: "That action is not available right now.",
      error_code: "UNKNOWN_CAPABILITY",
    };
  }

  const alwaysAllow = input.workflow.globalPolicies?.alwaysAllow || [];
  if (alwaysAllow.includes(cap.id)) {
    return { ok: true };
  }

  const node = input.workflow.nodes.find((n) => n.id === input.state.currentNodeId);
  if (!node) {
    return { ok: false, speak: "I'm not sure what to do next.", error_code: "NO_ACTIVE_NODE" };
  }

  const allowedOnNode = nodeAllowsCapability(node, cap.id);
  const envelopeCaps = Array.isArray(input.state.flags._envelopeCapabilities)
    ? (input.state.flags._envelopeCapabilities as string[])
    : [];
  const allowedOnEnvelope = envelopeCaps.includes(cap.id);

  const modifyIntentAllowed =
    node.type === "confirmation" &&
    ((input.state.flags.rescheduleIntent && cap.id === "calendar.reschedule") ||
      (input.state.flags.cancelIntent && cap.id === "calendar.cancel"));

  if (!allowedOnNode && !allowedOnEnvelope && !modifyIntentAllowed) {
    return {
      ok: false,
      speak: "I need to finish the current step before I can do that.",
      error_code: "CAPABILITY_NOT_AUTHORIZED",
    };
  }

  if (cap.confirmationPolicy === "required_before_execute" && !input.state.confirmationReceived) {
    if (
      input.toolName === "confirm_booking" ||
      input.toolName === "reschedule_appointment" ||
      input.toolName === "cancel_appointment" ||
      cap.id === "calendar.create_booking" ||
      cap.id === "calendar.reschedule" ||
      cap.id === "calendar.cancel"
    ) {
      // Confirmation tools carry confirmed flag — checked in domain layer
      return { ok: true };
    }
    return {
      ok: false,
      speak: "I need explicit confirmation before I can complete that.",
      error_code: "CONFIRMATION_REQUIRED",
    };
  }

  if (cap.id === "calendar.check_availability") {
    const missingCount = Number(input.state.flags.missingFieldCount ?? 0);
    const modifyFlow = Boolean(input.state.flags.rescheduleIntent || input.state.flags.cancelIntent);
    if (missingCount > 0 && !modifyFlow) {
      return {
        ok: false,
        speak: "I still need a bit more information before I can check availability.",
        error_code: "MISSING_REQUIRED_DATA",
      };
    }

    const collectNode = input.workflow.nodes.find((n) => n.type === "collect_fields");
    if (collectNode?.fields?.length && !modifyFlow) {
      const missing = collectNode.fields
        .filter((f) => f.required && !input.state.collectedFields[f.id]?.trim())
        .map((f) => f.id);
      if (missing.length) {
        return {
          ok: false,
          speak: "I still need a bit more information before I can check availability.",
          error_code: "MISSING_REQUIRED_DATA",
        };
      }
    }
  }

  return { ok: true };
}

function nodeAllowsCapability(node: WorkflowNode, capabilityId: string): boolean {
  if (node.capability === capabilityId) return true;
  if (node.type === "collect_fields" && capabilityId.startsWith("data.")) return true;
  if (node.type === "condition" && node.capability === capabilityId) return true;
  if (node.type === "handoff" && capabilityId === "call.transfer") return true;
  if (node.type === "completion" && capabilityId === "call.end") return true;
  if (node.type === "choice" && capabilityId === "calendar.select_slot") return true;
  return false;
}

export function stampEnvelopeCapabilities(
  state: WorkflowRuntimeSnapshot,
  capabilityIds: string[],
): WorkflowRuntimeSnapshot {
  return {
    ...state,
    flags: {
      ...state.flags,
      _envelopeCapabilities: capabilityIds,
    },
  };
}
