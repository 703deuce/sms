import "server-only";

import type { IntakeFieldKey, IntakeFieldStatus } from "./types";
import {
  captureIntakeFieldPayload,
  type IntakeFieldCapture,
} from "./validate-fields";

function coalesceSaveIntakeFieldsRaw(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const base = (raw.fields || raw.intake_fields) as Record<string, unknown> | undefined;
  const out: Record<string, unknown> =
    base && typeof base === "object" ? { ...base } : {};
  const topLevel: Array<[string, string]> = [
    ["email", "email"],
    ["name", "name"],
    ["phone", "phone"],
    ["address", "address"],
    ["service_reason", "service_reason"],
  ];
  for (const [rawKey, intakeKey] of topLevel) {
    const v = raw[rawKey];
    if (v != null && String(v).trim() && !String(out[intakeKey] ?? "").trim()) {
      out[intakeKey] = v;
    }
  }
  if (base && typeof base === "object") return out;
  if (!Object.keys(out).length) return undefined;
  return out;
}
import { applyCallerAniToIntakeState, redirectPhoneSaveAwayFromAni } from "./caller-phone";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./load-call-context";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./session-store";
import { scheduleIntakePersistence } from "./persist-deferred";
import { getIntakeReadiness } from "./readiness";
import {
  mergeWorkflowIntoContext,
  transitionAfterIntakeSave,
  workflowFromContext,
} from "../booking-workflow";
import { rederiveWorkflowStageForContext } from "../workflow-rederive";
import {
  mergeSchedulingPreferenceRecord,
  syncWorkflowRequestedDateFromScheduling,
} from "../scheduling-preference-state";
import {
  resolveVoiceV2BookingStrategyForContext,
  resolveVoiceV2PstnLiveBookingForContext,
  workflowPayloadForContext,
} from "../booking-workflow-hooks";
import { SaveIntakeTrace } from "./save-intake-trace";
import {
  getIntakeIdempotentResult,
  storeIntakeIdempotentResult,
} from "./intake-idempotency";
import type { VoiceV2ContextLookupTrace } from "../session/context-lookup-trace";
import { isTrustedPrismaVoiceCallId } from "./resolve-trusted-call-id";
import {
  isBookingIntentOnlyFields,
  stripBookingIntentOnlyServiceReason,
} from "./booking-intent-guard";
import { VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS } from "../caller-experience-law";
import {
  applySchedulingPreferenceToContext,
  extractSchedulingRequestedDate,
  intakeFieldsHaveValues,
} from "./scheduling-preference";
import { applyQualificationToContext } from "../qualification-evaluator";
import { applyAfterHoursEvaluations } from "../after-hours-orchestrator";
import type { VoiceV2PublishedQualificationConfig } from "../qualification-types";

function qualificationConfigFromContext(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
): VoiceV2PublishedQualificationConfig {
  const cap = ctx.capabilities;
  return {
    qualificationEnabled: Boolean(cap?.qualificationEnabled),
    qualificationRequiredBeforePrimaryAction: Boolean(
      cap?.qualificationRequiredBeforePrimaryAction,
    ),
    qualificationRevision: cap?.qualificationRevision || "none",
    rules: cap?.qualificationRules || [],
    rulesMatchMode: cap?.qualificationRulesMatchMode === "ANY" ? "ANY" : "ALL",
    supportedZipCodes: cap?.qualificationSupportedZipCodes || [],
    notQualifiedFallback: cap?.qualificationNotQualifiedFallback || "TAKE_MESSAGE",
    needsReviewFallback: cap?.qualificationNeedsReviewFallback || "TAKE_MESSAGE",
    qualificationFieldKeys: cap?.qualificationFieldKeys || [],
  };
}

export type SaveIntakeTimingMs = {
  VALIDATION_MS: number;
  STATE_UPDATE_MS: number;
  TOTAL_MS: number;
};

export type SaveIntakeResult =
  | {
      status: "INTAKE_SAVED";
      saved: IntakeFieldKey[];
      ignored_fields?: IntakeFieldKey[];
      invalid_fields?: IntakeFieldKey[];
      readiness: ReturnType<typeof getIntakeReadiness>;
      workflow?: Record<string, unknown>;
      observability?: { trace: ReturnType<SaveIntakeTrace["toJSON"]>; save_sequence: number };
      timing_ms: SaveIntakeTimingMs;
    }
  | {
      status: "INTAKE_VALIDATION_ERROR";
      invalid_fields: IntakeFieldKey[];
      disabled_fields: IntakeFieldKey[];
      timing_ms: SaveIntakeTimingMs;
    }
  | {
      status: "FIELD_NOT_ENABLED";
      ignored_fields: IntakeFieldKey[];
      saved_fields: IntakeFieldKey[];
      readiness: ReturnType<typeof getIntakeReadiness>;
      workflow?: Record<string, unknown>;
      observability?: { trace: ReturnType<SaveIntakeTrace["toJSON"]>; save_sequence: number };
      timing_ms: SaveIntakeTimingMs;
    }
  | {
      status: "SCHEDULING_PREFERENCE_NOTED";
      requested_date: string;
      readiness: ReturnType<typeof getIntakeReadiness>;
      workflow?: Record<string, unknown>;
      observability?: { trace: ReturnType<SaveIntakeTrace["toJSON"]>; save_sequence: number };
      timing_ms: SaveIntakeTimingMs;
    }
  | { status: "SESSION_UNAVAILABLE"; timing_ms: SaveIntakeTimingMs }
  | {
      status: typeof VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS;
      timing_ms: SaveIntakeTimingMs;
      law: string;
    };

async function attachBookingWorkflow(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  raw: Record<string, unknown>,
  savedKeys: IntakeFieldKey[],
  workspaceId: string,
  agentId: string,
  trace?: SaveIntakeTrace,
): Promise<{
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>;
  workflow: Record<string, unknown>;
  pstnFlagReloaded: boolean;
}> {
  trace?.mark("WORKFLOW_TRANSITION_START");
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const { flag: voiceV2PstnLiveBooking, reloaded: pstnFlagReloaded } =
    await resolveVoiceV2PstnLiveBookingForContext(ctx, workspaceId, agentId);
  const bookingStrategy = await resolveVoiceV2BookingStrategyForContext(
    ctx,
    workspaceId,
    agentId,
  );
  let nextCtx = transitionAfterIntakeSave({
    ctx,
    raw,
    savedKeys,
    readiness,
    voiceV2PstnLiveBooking,
    bookingStrategy,
  });
  nextCtx = applyQualificationToContext(
    nextCtx,
    qualificationConfigFromContext(nextCtx),
  );
  if (nextCtx.capabilities?.afterHoursHandling) {
    nextCtx = applyAfterHoursEvaluations(nextCtx, nextCtx.capabilities.afterHoursHandling);
  }
  let hydrated = nextCtx;
  const schedulingDate = extractSchedulingRequestedDate(raw);
  if (schedulingDate) {
    hydrated = {
      ...hydrated,
      schedulingPreference: mergeSchedulingPreferenceRecord(hydrated.schedulingPreference, {
        requestedDate: schedulingDate,
        updatedAt: new Date().toISOString(),
        evidence: "save_intake_scheduling_preference",
      }),
    };
    hydrated = mergeWorkflowIntoContext(
      hydrated,
      syncWorkflowRequestedDateFromScheduling(workflowFromContext(hydrated), hydrated.schedulingPreference),
    );
  }
  hydrated = rederiveWorkflowStageForContext(hydrated);
  setVoiceV2CallContext(hydrated);
  trace?.mark("WORKFLOW_TRANSITION_END");
  return {
    ctx: hydrated,
    workflow: workflowPayloadForContext(hydrated, voiceV2PstnLiveBooking, bookingStrategy),
    pstnFlagReloaded,
  };
}

function finalizeObservability(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  trace: SaveIntakeTrace,
): { trace: ReturnType<SaveIntakeTrace["toJSON"]>; save_sequence: number } {
  const saveSequence = (ctx.intakeSaveCount ?? 0) + 1;
  const next = { ...ctx, intakeSaveCount: saveSequence };
  setVoiceV2CallContext(next);
  trace.mark("RESPONSE_SERIALIZED", { save_sequence: saveSequence });
  const json = trace.toJSON();
  json.save_sequence_hint = saveSequence;
  return { trace: json, save_sequence: saveSequence };
}

function nextStatus(
  key: IntakeFieldKey,
  previous: IntakeFieldStatus | undefined,
  isCorrection: boolean,
): IntakeFieldStatus {
  if (isCorrection) return "CORRECTED";
  if (previous === "PREFILLED") return "CAPTURED";
  if (previous === "CONFIRMED") return "CAPTURED";
  return "CAPTURED";
}

function commitCapturedFields(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  captures: Partial<Record<IntakeFieldKey, IntakeFieldCapture>>,
  timing: { validationMs: number; t0: number },
): {
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>;
  saved: IntakeFieldKey[];
  stateUpdateMs: number;
} {
  const uStart = Date.now();
  // STATE_UPDATE traced by caller via validationMs path
  const saved: IntakeFieldKey[] = [];
  const now = new Date().toISOString();
  const nextState = { ...ctx.intakeState };

  for (const [key, capture] of Object.entries(captures)) {
    const k = key as IntakeFieldKey;
    const raw = capture?.raw ?? "";
    if (!raw.trim()) continue;
    const prev = nextState[k];
    const unchanged = prev?.value === raw;
    if (unchanged && prev?.status !== "MISSING") continue;

    const isCorrection =
      Boolean(prev?.value?.trim()) &&
      prev!.value.trim() !== raw.trim() &&
      prev!.status !== "PREFILLED" &&
      prev!.status !== "MISSING";
    nextState[k] = {
      value: raw,
      normalizedValue: capture?.normalizedValue,
      status: nextStatus(k, prev?.status, isCorrection),
      source: "CALLER",
      updatedAt: now,
    };
    saved.push(k);
  }

  const updated = { ...ctx, intakeState: nextState };
  setVoiceV2CallContext(updated);
  return { ctx: updated, saved, stateUpdateMs: Date.now() - uStart };
}

export async function executeVoiceV2SaveIntakeFields(
  raw: Record<string, unknown>,
  workspaceId: string,
  agentId: string,
  observability?: {
    trace?: SaveIntakeTrace;
    trustedPrismaCallId?: string | null;
    lookupTrace?: VoiceV2ContextLookupTrace;
  },
): Promise<SaveIntakeResult> {
  const trace = observability?.trace ?? new SaveIntakeTrace();
  trace.mark("REQUEST_RECEIVED");
  const t0 = Date.now();
  const emptyTiming = (): SaveIntakeTimingMs => ({
    VALIDATION_MS: 0,
    STATE_UPDATE_MS: 0,
    TOTAL_MS: Date.now() - t0,
  });

  const callControlId = String(raw.call_id || raw.callId || raw.call_control_id || "").trim();
  const conversationId = String(
    raw.conversation_id || raw.telnyx_conversation_id || raw.telnyxConversationId || "",
  ).trim();
  const fromE164 = String(raw.from || raw.caller || raw.from_e164 || "").trim();
  const trustedPrismaCallId = observability?.trustedPrismaCallId?.trim() || "";

  const sessionKey = resolveSessionKey({ callControlId, conversationId });
  const canonicalHint =
    trustedPrismaCallId && isTrustedPrismaVoiceCallId(trustedPrismaCallId)
      ? `call:${trustedPrismaCallId}`
      : null;

  const toolInvocationId = String(
    raw.tool_invocation_id || raw.toolInvocationId || "",
  ).trim();

  if (canonicalHint && toolInvocationId) {
    const cached = await getIntakeIdempotentResult(canonicalHint, toolInvocationId);
    if (cached) return cached;
  }

  if (!sessionKey && !canonicalHint) {
    return { status: "SESSION_UNAVAILABLE", timing_ms: emptyTiming() };
  }

  const fieldsRawEarly = (raw.fields || raw.intake_fields) as Record<string, unknown> | undefined;
  if (fieldsRawEarly && typeof fieldsRawEarly === "object" && isBookingIntentOnlyFields(fieldsRawEarly)) {
    trace.mark("BOOKING_INTENT_CONVERSATION_ONLY", { law: "P7" });
    return {
      status: VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS,
      timing_ms: {
        VALIDATION_MS: 0,
        STATE_UPDATE_MS: 0,
        TOTAL_MS: Date.now() - t0,
      },
      law: "VOICE_V2_CALLER_EXPERIENCE_LAW_P7",
    };
  }

  let ctx =
    (canonicalHint ? getVoiceV2CallContext(canonicalHint) : null) ||
    (sessionKey ? getVoiceV2CallContext(sessionKey) : null);

  if (ctx) {
    trace.mark("CALL_CONTEXT_LOOKUP_START");
    trace.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "l1_direct" });
  } else {
    ctx = await ensureVoiceV2CallContext({
      workspaceId,
      agentId,
      callControlId,
      conversationId,
      fromE164,
      trustedPrismaCallId,
      trace,
      lookupTrace: observability?.lookupTrace,
    });
  }

  if (!ctx) {
    return { status: "SESSION_UNAVAILABLE", timing_ms: emptyTiming() };
  }

  ctx = applyCallerAniToIntakeState(ctx, fromE164);
  setVoiceV2CallContext(ctx);

  const canonicalSessionKey = ctx.sessionKey;

  async function finishWithIdempotency(result: SaveIntakeResult): Promise<SaveIntakeResult> {
    if (
      toolInvocationId &&
      (result.status === "INTAKE_SAVED" ||
        result.status === "FIELD_NOT_ENABLED" ||
        result.status === "SCHEDULING_PREFERENCE_NOTED")
    ) {
      await storeIntakeIdempotentResult(canonicalSessionKey, toolInvocationId, result);
    }
    return result;
  }

  const fieldsRaw = coalesceSaveIntakeFieldsRaw(raw);
  if (!fieldsRaw || typeof fieldsRaw !== "object") {
    return {
      status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: [],
      disabled_fields: [],
      timing_ms: emptyTiming(),
    };
  }

  const schedulingDate = extractSchedulingRequestedDate(raw);
  if (!intakeFieldsHaveValues(fieldsRaw) && !schedulingDate) {
    return {
      status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: [],
      disabled_fields: [],
      timing_ms: emptyTiming(),
    };
  }
  if (schedulingDate && !intakeFieldsHaveValues(fieldsRaw)) {
    trace.mark("VALIDATION_START");
    trace.mark("VALIDATION_END", { ms: 0, scheduling_only: true });
    ctx = applySchedulingPreferenceToContext(ctx, raw, schedulingDate);
    setVoiceV2CallContext(ctx);
    const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
    const wf = await attachBookingWorkflow(ctx, raw, [], workspaceId, agentId, trace);
    return finishWithIdempotency({
      status: "SCHEDULING_PREFERENCE_NOTED",
      requested_date: schedulingDate,
      readiness,
      workflow: wf.workflow,
      observability: finalizeObservability(wf.ctx, trace),
      timing_ms: {
        VALIDATION_MS: 0,
        STATE_UPDATE_MS: 0,
        TOTAL_MS: Date.now() - t0,
      },
    });
  }

  trace.mark("VALIDATION_START");
  const vStart = Date.now();
  const validationRaw = captureIntakeFieldPayload(ctx.intakeSchema, fieldsRaw);
  let captures = { ...validationRaw.captures };
  const stripped = stripBookingIntentOnlyServiceReason(
    Object.fromEntries(
      Object.entries(captures).map(([k, c]) => [k, c?.raw ?? ""]),
    ) as Partial<Record<IntakeFieldKey, string>>,
  );
  if (Object.keys(stripped).length !== Object.keys(captures).length) {
    for (const k of Object.keys(captures) as IntakeFieldKey[]) {
      if (!(k in stripped)) delete captures[k];
    }
  }
  const redirected = redirectPhoneSaveAwayFromAni(
    ctx,
    Object.fromEntries(
      Object.entries(captures).map(([k, c]) => [k, c?.raw ?? ""]),
    ) as Partial<Record<IntakeFieldKey, string>>,
  );
  for (const [k, v] of Object.entries(redirected)) {
    const key = k as IntakeFieldKey;
    const cap = captures[key];
    if (cap && cap.raw !== v) {
      captures[key] = { ...cap, raw: v! };
    }
  }
  let validation = validationRaw;
  if (validationRaw.ok && Object.keys(captures).length === 0) {
    validation = {
      ok: false,
      normalized: {},
      captures: {},
      invalidFields: validationRaw.invalidFields.length
        ? validationRaw.invalidFields
        : ["service_reason"],
      disabledFields: validationRaw.disabledFields,
    };
  } else if (validationRaw.ok) {
    validation = {
      ...validationRaw,
      captures,
      normalized: Object.fromEntries(
        Object.entries(captures).map(([k, c]) => [k, c?.raw ?? ""]),
      ) as Partial<Record<IntakeFieldKey, string>>,
    };
  }
  const validationMs = Date.now() - vStart;
  trace.mark("VALIDATION_END", { ms: validationMs });

  if (!validation.ok) {
    const onlyDisabled =
      validation.invalidFields.length === 0 && validation.disabledFields.length > 0;
    if (onlyDisabled) {
      const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
      const wf = await attachBookingWorkflow(ctx, raw, [], workspaceId, agentId, trace);
      return finishWithIdempotency({
        status: "FIELD_NOT_ENABLED",
        ignored_fields: validation.disabledFields,
        saved_fields: [],
        readiness,
        workflow: wf.workflow,
        observability: finalizeObservability(wf.ctx, trace),
        timing_ms: {
          VALIDATION_MS: validationMs,
          STATE_UPDATE_MS: 0,
          TOTAL_MS: Date.now() - t0,
        },
      });
    }
    const partial = commitCapturedFields(ctx, validation.captures, {
      validationMs,
      t0,
    });
    if (partial.saved.length > 0) {
      void scheduleIntakePersistence({
        workspaceId,
        sessionKey: canonicalSessionKey,
        callControlId: callControlId || null,
        snapshot: partial.ctx.intakeState,
        updatedAt: new Date().toISOString(),
      });
      const readiness = getIntakeReadiness(partial.ctx.intakeSchema, partial.ctx.intakeState);
      const wf = await attachBookingWorkflow(
        partial.ctx,
        raw,
        partial.saved,
        workspaceId,
        agentId,
        trace,
      );
      return finishWithIdempotency({
        status: "INTAKE_SAVED",
        saved: partial.saved,
        ignored_fields: validation.disabledFields.length ? validation.disabledFields : undefined,
        invalid_fields: validation.invalidFields.length ? validation.invalidFields : undefined,
        readiness,
        workflow: wf.workflow,
        observability: finalizeObservability(wf.ctx, trace),
        timing_ms: {
          VALIDATION_MS: validationMs,
          STATE_UPDATE_MS: partial.stateUpdateMs,
          TOTAL_MS: Date.now() - t0,
        },
      });
    }
    return {
      status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: validation.invalidFields,
      disabled_fields: validation.disabledFields,
      timing_ms: {
        VALIDATION_MS: validationMs,
        STATE_UPDATE_MS: 0,
        TOTAL_MS: Date.now() - t0,
      },
    };
  }

  const committed = commitCapturedFields(ctx, validation.captures, { validationMs, t0 });
  ctx = committed.ctx;

  void scheduleIntakePersistence({
    workspaceId,
    sessionKey: canonicalSessionKey,
    callControlId: callControlId || null,
    snapshot: ctx.intakeState,
    updatedAt: new Date().toISOString(),
  });

  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const ignoredFields = validation.disabledFields;
  const wf = await attachBookingWorkflow(ctx, raw, committed.saved, workspaceId, agentId, trace);

  return finishWithIdempotency({
    status: "INTAKE_SAVED",
    saved: committed.saved,
    ignored_fields: ignoredFields.length ? ignoredFields : undefined,
    readiness,
    workflow: wf.workflow,
    observability: finalizeObservability(wf.ctx, trace),
    timing_ms: {
      VALIDATION_MS: validationMs,
      STATE_UPDATE_MS: committed.stateUpdateMs,
      TOTAL_MS: Date.now() - t0,
    },
  });
}
