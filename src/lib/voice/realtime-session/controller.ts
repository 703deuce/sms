/**
 * Fast realtime session controller — separates conversational routing from durable runtime.
 */
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import { recordCurrentField } from "@/lib/voice/field-runtime/save";
import { appendFieldReceipt, transitionState } from "@/lib/voice/workflow-engine/runtime-state";
import { executeContinueWorkflow } from "@/lib/voice/workflow-engine/continue-workflow";
import {
  computeWorkflowStateFromSession,
  getOrCreateRealtimeSession,
  refreshSessionFieldState,
  setSessionFieldFast,
  syncSessionToDurableStore,
  updateSessionAfterRuntimeChange,
} from "./init";
import { TurnLatencyTracker, logTurnLatency } from "./latency";
import { getRealtimeSessionStore } from "./store";
import type { AmyRealtimeSession, RuntimeTurnRequest, RuntimeTurnResponse } from "./types";

const END_CALL_RE =
  /\b(bye|goodbye|never\s*mind|hang\s*up|stop\s*calling|not\s*interested|don'?t\s*call)\b/i;
const TRANSFER_RE =
  /\b(speak\s+to|talk\s+to|real\s+person|human|agent|representative|manager|operator)\b/i;
const MESSAGE_RE =
  /\b(just\s+(take|leave)\s+a\s+message|call\s+me\s+back|have\s+someone\s+call)\b/i;
const CONFIRM_RE =
  /\b(yes|yeah|yep|sure|correct|right|go ahead|book it|please do|sounds good|that works|confirm|do it|okay|ok)\b/i;

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
  sessionDefault?: string | null,
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
  return sessionDefault ?? null;
}

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

function normalizeResponse(
  session: AmyRealtimeSession,
  result: Record<string, unknown>,
  tracker: TurnLatencyTracker,
  decision: string,
  intent?: string,
  operationDurationMs?: number,
): RuntimeTurnResponse {
  const stateAfter =
    (result.workflow_state as AmyRealtimeSession["currentState"]) ||
    session.currentState;
  const snapshot = tracker.snapshot({
    stateAfter,
    intent,
    decision,
    operationStarted: Boolean(result.operation_id || result.operation),
    operationId:
      typeof result.operation_id === "string"
        ? result.operation_id
        : typeof (result.operation as { id?: string })?.id === "string"
          ? (result.operation as { id: string }).id
          : undefined,
    operationDurationMs: operationDurationMs,
  });
  logTurnLatency(snapshot);
  return tracker.attach(
    {
      ok: result.ok !== false,
      mode: result.end_call ? "end_call" : "speak",
      ...result,
    },
    snapshot,
  );
}

export async function executeRealtimeSessionTurn(
  input: RuntimeTurnRequest,
): Promise<RuntimeTurnResponse> {
  if (!input.callId) throw new Error("callId required");
  if (!input.agentId) throw new Error("agentId required for realtime session");

  const utterance = String(input.utterance || "").trim();
  const intent = String(input.interpreted_intent || "").toLowerCase();
  const extracted = input.extracted_information || {};
  const workflow = input.workflow || "book_appointment";

  const sessionLoadStart = Date.now();
  const store = getRealtimeSessionStore();
  const releaseLock = await store.acquireLock(input.callId);
  let session: AmyRealtimeSession;
  try {
    session = await getOrCreateRealtimeSession({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: input.serviceName,
    });
  } finally {
    await releaseLock();
  }

  const tracker = new TurnLatencyTracker(
    input.callId,
    session.sessionId,
    session.currentState,
    session.telnyxConversationId,
  );
  tracker.setSessionLoad(Date.now() - sessionLoadStart);
  tracker.mark("session_loaded");

  const serviceName = pickServiceName(extracted, input.serviceName, session.serviceName);
  const state = session.currentState;

  session = await updateSessionAfterRuntimeChange(session, {
    lastUserUtterance: utterance || null,
    lastIntent: intent || null,
    serviceName: serviceName ?? session.serviceName,
  });

  const routingStart = Date.now();

  // Fast path: end call
  if (
    intent === "end_call" ||
    intent === "hangup" ||
    intent === "opt_out" ||
    END_CALL_RE.test(utterance)
  ) {
    tracker.setRouting(Date.now() - routingStart);
    return normalizeResponse(
      session,
      {
        ok: true,
        success: true,
        action: "END_CALL",
        workflow_state: state,
        speak: "No problem. Have a great day.",
        end_call: true,
      },
      tracker,
      "end_call",
      intent,
    );
  }

  // Transfer — still requires external action (authoritative)
  if (intent === "transfer" || intent === "escalate" || TRANSFER_RE.test(utterance)) {
    tracker.setRouting(Date.now() - routingStart);
    const extStart = Date.now();
    const { executeBuiltinVoiceAction } = await import("@/lib/voice/tools/builtin-actions");
    try {
      const result = (await executeBuiltinVoiceAction({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        toolType: "escalate_human",
        input: { reason: utterance || "Caller requested a person" },
      })) as Record<string, unknown>;
      tracker.addExternal(Date.now() - extStart);
      return normalizeResponse(session, result, tracker, "transfer", intent);
    } catch (err) {
      tracker.addExternal(Date.now() - extStart);
      return normalizeResponse(
        session,
        {
          ok: false,
          success: false,
          action: "TRANSFER",
          workflow_state: state,
          speak:
            err instanceof Error
              ? err.message
              : "I wasn't able to transfer right now. Can I take a message instead?",
        },
        tracker,
        "transfer_failed",
        intent,
      );
    }
  }

  // Message taking — authoritative external
  if (intent === "take_message" || MESSAGE_RE.test(utterance)) {
    tracker.setRouting(Date.now() - routingStart);
    const extStart = Date.now();
    const { executeBuiltinVoiceAction } = await import("@/lib/voice/tools/builtin-actions");
    const result = (await executeBuiltinVoiceAction({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      toolType: "take_structured_message",
      input: {
        message: pickFieldValue(extracted, utterance),
        callback_requested: true,
      },
    })) as Record<string, unknown>;
    tracker.addExternal(Date.now() - extStart);
    return normalizeResponse(session, result, tracker, "take_message", intent);
  }

  // Fast path: field collection using cached manifest (no getWorkflowRequirements DB chain)
  if (state === "COLLECTING_FIELDS" || state === "INTENT_DISCOVERY") {
    const activeField = session.activeField;
    if (activeField && utterance) {
      tracker.setRouting(Date.now() - routingStart);
      const dbStart = Date.now();
      const recorded = await recordCurrentField({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        value: pickFieldValue(extracted, utterance),
        workflow,
        serviceName,
      });
      tracker.addDb(Date.now() - dbStart);

      if (recorded && (recorded as { ok?: boolean }).ok !== false) {
        let nextSession = setSessionFieldFast(
          session,
          activeField,
          pickFieldValue(extracted, utterance),
        );
        if (nextSession.missingFieldIds.length === 0) {
          nextSession = await updateSessionAfterRuntimeChange(nextSession, {
            runtime: transitionState(
              { ...nextSession.runtime, intent: workflow },
              "CHECKING_AVAILABILITY",
              "fields_complete",
            ),
          });
        } else {
          nextSession = await updateSessionAfterRuntimeChange(nextSession, {
            runtime: appendFieldReceipt(
              { ...nextSession.runtime, intent: workflow },
              activeField,
              pickFieldValue(extracted, utterance),
            ),
          });
        }
        await syncSessionToDurableStore(nextSession).catch(() => undefined);
        return normalizeResponse(
          nextSession,
          recorded as Record<string, unknown>,
          tracker,
          "record_field",
          intent,
        );
      }
    }

    // Fast routing response without external calls
    const field = session.fieldManifest.find((f) => f.field_id === session.activeField);
    tracker.setRouting(Date.now() - routingStart);
    return normalizeResponse(
      session,
      {
        ok: true,
        success: true,
        action: "ASK_CALLER",
        workflow_state: state,
        speak:
          field?.collection_instruction ||
          "I still need a few details before we check availability.",
        current_field: field || null,
        missing_fields: session.missingFieldIds.map((id) =>
          session.fieldManifest.find((f) => f.field_id === id),
        ).filter(Boolean),
      },
      tracker,
      "collect_fields_prompt",
      intent,
    );
  }

  tracker.setRouting(Date.now() - routingStart);
  tracker.mark("routing_decision");

  // Scheduling path — external ops required for availability/hold/book (authoritative, blocking)
  const extStart = Date.now();
  const result = await executeContinueWorkflow({
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
    sessionContext: session,
  });
  const operationDurationMs = Date.now() - extStart;
  tracker.addExternal(operationDurationMs);

  // Refresh session from result
  const dbStart = Date.now();
  const refreshed = await getOrCreateRealtimeSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName,
  });
  const slots = Array.isArray((result.data as { slots?: unknown[] })?.slots)
    ? ((result.data as { slots: Array<{ startsAt?: string; start_time?: string }> }).slots)
        .map((s) => String(s.startsAt || s.start_time || ""))
        .filter(Boolean)
    : refreshed.availableSlots;

  await updateSessionAfterRuntimeChange(refreshed, {
    currentState:
      (result.workflow_state as AmyRealtimeSession["currentState"]) || refreshed.currentState,
    availableSlots: slots.length ? slots : refreshed.availableSlots,
    heldSlot:
      typeof (result.data as { selected_slot?: string })?.selected_slot === "string"
        ? (result.data as { selected_slot: string }).selected_slot
        : refreshed.heldSlot,
    selectedSlot:
      typeof (result.data as { selected_slot?: string })?.selected_slot === "string"
        ? (result.data as { selected_slot: string }).selected_slot
        : refreshed.selectedSlot,
    lastRuntimeResult: result,
  });
  tracker.addDb(Date.now() - dbStart);

  const decision =
    state === "CHECKING_AVAILABILITY"
      ? "availability"
      : state === "SELECTING_SLOT"
        ? "slot_selection"
        : state === "READY_TO_BOOK"
          ? "booking"
          : "continue_workflow";

  return normalizeResponse(refreshed, result, tracker, decision, intent, operationDurationMs);
}

export { computeWorkflowStateFromSession, refreshSessionFieldState };
