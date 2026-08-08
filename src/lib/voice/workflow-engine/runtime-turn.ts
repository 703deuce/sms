/**
 * Caller Amy — single runtime gateway.
 * LLM submits caller meaning; runtime owns state, tools, and actions.
 */

import { getPrisma } from "@/lib/db";
import { buildRuntimeContext, computeWorkflowState } from "./engine";
import { executeContinueWorkflow } from "./continue-workflow";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";

export type RuntimeTurnInput = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  utterance?: string | null;
  interpreted_intent?: string | null;
  extracted_information?: Record<string, unknown>;
  confirm?: boolean;
  workflow?: WorkflowAction;
  serviceName?: string | null;
};

const END_CALL_RE =
  /\b(bye|goodbye|never\s*mind|hang\s*up|stop\s*calling|not\s*interested|don'?t\s*call)\b/i;
const TRANSFER_RE =
  /\b(speak\s+to|talk\s+to|real\s+person|human|agent|representative|manager|operator)\b/i;
const MESSAGE_RE =
  /\b(just\s+(take|leave)\s+a\s+message|call\s+me\s+back|have\s+someone\s+call)\b/i;

function pickFieldValue(
  extracted: Record<string, unknown>,
  utterance: string,
): string {
  for (const v of Object.values(extracted)) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return utterance.trim();
}

function pickServiceName(
  extracted: Record<string, unknown>,
  explicit?: string | null,
): string | null {
  if (explicit?.trim()) return explicit.trim();
  for (const key of [
    "service",
    "serviceName",
    "service_name",
    "service_requested",
    "appointmentType",
  ]) {
    const v = extracted[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

const CONFIRM_RE =
  /\b(yes|yeah|yep|sure|correct|right|go ahead|book it|please do|sounds good|that works|confirm|do it|okay|ok)\b/i;

function inferConfirm(
  utterance: string,
  extracted: Record<string, unknown>,
  state: string,
): boolean {
  if (state !== "READY_TO_BOOK" && state !== "BOOKING_IN_PROGRESS") return false;
  if (extracted.confirm === true || extracted.confirmed === true) return true;
  const intent = String(extracted.intent || extracted.interpreted_intent || "").toLowerCase();
  if (intent === "confirm" || intent === "confirm_booking") return true;
  return CONFIRM_RE.test(utterance.trim());
}

export async function executeAmyRuntimeTurn(
  input: RuntimeTurnInput,
): Promise<Record<string, unknown>> {
  const utterance = String(input.utterance || "").trim();
  const intent = String(input.interpreted_intent || "").toLowerCase();
  const extracted = input.extracted_information || {};
  const workflow = input.workflow || "book_appointment";
  const serviceName = pickServiceName(extracted, input.serviceName);

  if (!input.callId) throw new Error("callId required");

  const { state } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName,
  });

  // Runtime-owned end call
  if (
    intent === "end_call" ||
    intent === "hangup" ||
    intent === "opt_out" ||
    END_CALL_RE.test(utterance)
  ) {
    return {
      ok: true,
      success: true,
      action: "END_CALL",
      workflow_state: state,
      speak: "No problem. Have a great day.",
      end_call: true,
    };
  }

  // Runtime-owned transfer escalation proposal
  if (intent === "transfer" || intent === "escalate" || TRANSFER_RE.test(utterance)) {
    const { executeBuiltinVoiceAction } = await import("@/lib/voice/tools/builtin-actions");
    try {
      return (await executeBuiltinVoiceAction({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        toolType: "escalate_human",
        input: { reason: utterance || "Caller requested a person" },
      })) as Record<string, unknown>;
    } catch (err) {
      return {
        ok: false,
        success: false,
        action: "TRANSFER",
        workflow_state: state,
        speak:
          err instanceof Error
            ? err.message
            : "I wasn't able to transfer right now. Can I take a message instead?",
      };
    }
  }

  // Runtime-owned message taking
  if (intent === "take_message" || MESSAGE_RE.test(utterance)) {
    const { executeBuiltinVoiceAction } = await import("@/lib/voice/tools/builtin-actions");
    return (await executeBuiltinVoiceAction({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      toolType: "take_structured_message",
      input: {
        message: pickFieldValue(extracted, utterance),
        callback_requested: true,
      },
    })) as Record<string, unknown>;
  }

  // Field collection phase — runtime records, not model tool choice
  if (state === "COLLECTING_FIELDS" || state === "INTENT_DISCOVERY") {
    const ctx = await buildRuntimeContext({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName,
    });
    const activeField = ctx.current_field?.field_id;
    if (activeField && utterance) {
      const { recordCurrentField } = await import("@/lib/voice/field-runtime/save");
      const recorded = await recordCurrentField({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        value: pickFieldValue(extracted, utterance),
        workflow,
        serviceName,
      });
      if (recorded && (recorded as { ok?: boolean }).ok !== false) {
        return recorded as Record<string, unknown>;
      }
    }
  }

  // Scheduling / slot selection / booking — internal continue_workflow
  if (
    state === "CHECKING_AVAILABILITY" ||
    state === "SELECTING_SLOT" ||
    state === "READY_TO_BOOK" ||
    state === "BOOKING_IN_PROGRESS" ||
    state === "COMPLETE" ||
    utterance ||
    input.confirm
  ) {
    return executeContinueWorkflow({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      userInput: utterance || null,
      confirm: input.confirm === true || inferConfirm(utterance, extracted, state),
      workflow,
      serviceName,
      startsAt:
        typeof extracted.starts_at === "string"
          ? extracted.starts_at
          : typeof extracted.slot === "string"
            ? extracted.slot
            : null,
    });
  }

  // Default: return runtime context for Amy to speak naturally
  const ctx = await buildRuntimeContext({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName,
  });

  return {
    ok: true,
    success: true,
    action: "ASK_CALLER",
    ...ctx,
    workflow_state: ctx.state,
  };
}
