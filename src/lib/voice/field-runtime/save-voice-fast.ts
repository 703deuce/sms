import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { refreshSessionFieldState, setSessionFieldFast } from "@/lib/voice/realtime-session/init";
import { appendFieldReceipt, ensureAgentRuntime, saveAgentRuntime } from "@/lib/voice/workflow-engine/runtime-state";
import { deriveNextAction } from "@/lib/voice/workflow-engine/next-action";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { FieldValidationError, validateFieldValue } from "./validate";
import {
  getCachedWorkflowFieldSession,
  setCachedWorkflowFieldSession,
} from "./session-cache";
import {
  loadWorkflowFieldSession,
  saveWorkflowFieldSession,
  setSessionField,
} from "./session";
import type { RuntimeFieldManifestEntry, WorkflowAction } from "./types";

export type VoiceFieldSaveTiming = {
  validateMs: number;
  sessionLoadMs: number;
  sessionWriteMs: number;
  sessionRefreshMs: number;
  totalMs: number;
};

function missingFromManifest(
  manifest: RuntimeFieldManifestEntry[],
  collected: Record<string, string>,
): RuntimeFieldManifestEntry[] {
  return manifest.filter((f) => f.required && !collected[f.field_id]?.trim());
}

function speakForMissing(missing: RuntimeFieldManifestEntry[]): string {
  if (!missing.length) return "Got it. All required information is collected.";
  const first = missing[0]!;
  return first.collection_instruction || `I still need ${first.label.toLowerCase()}.`;
}

function deriveWorkflowState(complete: boolean, collectedCount: number): WorkflowState {
  if (complete) return "CHECKING_AVAILABILITY";
  return collectedCount > 0 ? "COLLECTING_FIELDS" : "INTENT_DISCOVERY";
}

/**
 * Hot-path field save for LiveKit voice — one metadata read/write cycle when cached,
 * in-memory Amy session refresh, background persistence for receipts/runtime.
 */
export async function recordFieldForLiveKitVoice(input: {
  amySession: AmyRealtimeSession;
  value: string;
  fieldId?: string;
}): Promise<{
  ok: boolean;
  speak: string;
  amySession: AmyRealtimeSession;
  workflowState: WorkflowState;
  timing: VoiceFieldSaveTiming;
  error_code?: string;
}> {
  const started = Date.now();
  let validateMs = 0;
  let sessionLoadMs = 0;
  let sessionWriteMs = 0;

  const fieldId = input.fieldId || input.amySession.activeField;
  if (!fieldId) {
    return {
      ok: false,
      speak: "I still need some information from you.",
      amySession: input.amySession,
      workflowState: input.amySession.currentState,
      timing: {
        validateMs: 0,
        sessionLoadMs: 0,
        sessionWriteMs: 0,
        sessionRefreshMs: 0,
        totalMs: Date.now() - started,
      },
      error_code: "NO_ACTIVE_FIELD",
    };
  }

  const manifestEntry =
    input.amySession.fieldManifest.find((f) => f.field_id === fieldId) || {
      field_id: fieldId,
      label: fieldId,
      type: "text" as const,
      required: true,
      collection_instruction: `Ask for ${fieldId}.`,
    };

  const validateStart = Date.now();
  try {
    validateFieldValue(
      {
        field_id: fieldId,
        label: manifestEntry.label,
        type: manifestEntry.type,
        required: manifestEntry.required,
        collection_instruction: manifestEntry.collection_instruction,
      },
      input.value,
    );
  } catch (err) {
    validateMs = Date.now() - validateStart;
    const message =
      err instanceof FieldValidationError ? err.message : "That value didn't look right.";
    return {
      ok: false,
      speak: message,
      amySession: input.amySession,
      workflowState: input.amySession.currentState,
      timing: {
        validateMs,
        sessionLoadMs: 0,
        sessionWriteMs: 0,
        sessionRefreshMs: 0,
        totalMs: Date.now() - started,
      },
      error_code: "VALIDATION_FAILED",
    };
  }
  validateMs = Date.now() - validateStart;

  const loadStart = Date.now();
  let fieldSession =
    getCachedWorkflowFieldSession(input.amySession.callId) ||
    (await loadWorkflowFieldSession(input.amySession.callId));
  sessionLoadMs = Date.now() - loadStart;

  if (!fieldSession) {
    return {
      ok: false,
      speak: "I couldn't save that just now. Could you repeat it?",
      amySession: input.amySession,
      workflowState: input.amySession.currentState,
      timing: {
        validateMs,
        sessionLoadMs,
        sessionWriteMs: 0,
        sessionRefreshMs: 0,
        totalMs: Date.now() - started,
      },
      error_code: "SESSION_MISSING",
    };
  }

  fieldSession = setSessionField(
    fieldSession,
    fieldId,
    String(input.value),
    "tool",
    manifestEntry.label,
  );
  setCachedWorkflowFieldSession(input.amySession.callId, fieldSession);

  const writeStart = Date.now();
  await saveWorkflowFieldSession(input.amySession.callId, fieldSession);
  sessionWriteMs = Date.now() - writeStart;

  const refreshStart = Date.now();
  let amySession = setSessionFieldFast(input.amySession, fieldId, String(input.value));
  const missing = missingFromManifest(amySession.fieldManifest, amySession.collectedFields);
  const workflowState = deriveWorkflowState(
    missing.length === 0,
    Object.keys(amySession.collectedFields).length,
  );
  amySession = refreshSessionFieldState({
    ...amySession,
    activeField: missing[0]?.field_id || null,
    currentState: workflowState,
    runtime: {
      ...amySession.runtime,
      intent: amySession.workflowId,
    },
  });
  const sessionRefreshMs = Date.now() - refreshStart;

  const complete = missing.length === 0;
  const speak = speakForMissing(missing);

  void persistFieldReceiptBackground({
    callId: input.amySession.callId,
    fieldId,
    value: String(input.value),
    workflowId: amySession.workflowId,
    serviceName: amySession.serviceName,
    complete,
    currentField: missing[0] || null,
    missing,
    workflowState,
  }).catch(() => undefined);

  return {
    ok: true,
    speak,
    amySession,
    workflowState,
    timing: {
      validateMs,
      sessionLoadMs,
      sessionWriteMs,
      sessionRefreshMs,
      totalMs: Date.now() - started,
    },
  };
}

async function persistFieldReceiptBackground(input: {
  callId: string;
  fieldId: string;
  value: string;
  workflowId: WorkflowAction;
  serviceName: string | null;
  complete: boolean;
  currentField: RuntimeFieldManifestEntry | null;
  missing: RuntimeFieldManifestEntry[];
  workflowState: WorkflowState;
}) {
  let runtime = await ensureAgentRuntime({
    callId: input.callId,
    workflowId: input.workflowId,
    serviceName: input.serviceName,
  });
  runtime = {
    ...appendFieldReceipt(runtime, input.fieldId, input.value),
    intent: input.workflowId,
  };
  await saveAgentRuntime(input.callId, runtime);

  const store = (await import("@/lib/voice/realtime-session/store")).getRealtimeSessionStore();
  const cached = await store.get(input.callId);
  if (cached) {
    await store.patch(input.callId, {
      runtime,
      currentState: input.workflowState,
      missingFieldIds: input.missing.map((m) => m.field_id),
      activeField: input.currentField?.field_id || null,
      lastRuntimeResult: {
        next_action: deriveNextAction({
          state: input.workflowState,
          complete: input.complete,
          currentField: input.currentField,
          missingFields: input.missing,
        }),
      },
    });
  }
}
