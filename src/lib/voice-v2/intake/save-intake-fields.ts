import "server-only";

import type { IntakeFieldKey, IntakeFieldStatus } from "./types";
import { validateIntakeFieldPayload } from "./validate-fields";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./load-call-context";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./session-store";
import { scheduleIntakePersistence } from "./persist-deferred";
import { getIntakeReadiness } from "./readiness";

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
      timing_ms: SaveIntakeTimingMs;
    }
  | { status: "SESSION_UNAVAILABLE"; timing_ms: SaveIntakeTimingMs };

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

function commitNormalizedFields(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  normalized: Partial<Record<IntakeFieldKey, string>>,
  timing: { validationMs: number; t0: number },
): {
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>;
  saved: IntakeFieldKey[];
  stateUpdateMs: number;
} {
  const uStart = Date.now();
  const saved: IntakeFieldKey[] = [];
  const now = new Date().toISOString();
  const nextState = { ...ctx.intakeState };

  for (const [key, value] of Object.entries(normalized)) {
    const k = key as IntakeFieldKey;
    const prev = nextState[k];
    const unchanged = prev?.value === value;
    if (unchanged && prev?.status !== "MISSING") continue;

    const isCorrection =
      Boolean(prev?.value?.trim()) &&
      prev!.value.trim() !== value!.trim() &&
      prev!.status !== "PREFILLED" &&
      prev!.status !== "MISSING";
    nextState[k] = {
      value: value!,
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
): Promise<SaveIntakeResult> {
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

  const sessionKey = resolveSessionKey({ callControlId, conversationId });
  if (!sessionKey) {
    return { status: "SESSION_UNAVAILABLE", timing_ms: emptyTiming() };
  }

  let ctx =
    getVoiceV2CallContext(sessionKey) ||
    (await ensureVoiceV2CallContext({
      workspaceId,
      agentId,
      callControlId,
      conversationId,
      fromE164,
    }));

  if (!ctx) {
    return { status: "SESSION_UNAVAILABLE", timing_ms: emptyTiming() };
  }

  const fieldsRaw = (raw.fields || raw.intake_fields) as Record<string, unknown> | undefined;
  if (!fieldsRaw || typeof fieldsRaw !== "object") {
    return {
      status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: [],
      disabled_fields: [],
      timing_ms: emptyTiming(),
    };
  }

  const vStart = Date.now();
  const validation = validateIntakeFieldPayload(ctx.intakeSchema, fieldsRaw);
  const validationMs = Date.now() - vStart;

  if (!validation.ok) {
    const onlyDisabled =
      validation.invalidFields.length === 0 && validation.disabledFields.length > 0;
    if (onlyDisabled) {
      const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
      return {
        status: "FIELD_NOT_ENABLED",
        ignored_fields: validation.disabledFields,
        saved_fields: [],
        readiness,
        timing_ms: {
          VALIDATION_MS: validationMs,
          STATE_UPDATE_MS: 0,
          TOTAL_MS: Date.now() - t0,
        },
      };
    }
    const partial = commitNormalizedFields(ctx, validation.normalized, {
      validationMs,
      t0,
    });
    if (partial.saved.length > 0) {
      void scheduleIntakePersistence({
        workspaceId,
        sessionKey,
        callControlId: callControlId || null,
        snapshot: partial.ctx.intakeState,
        updatedAt: new Date().toISOString(),
      });
      const readiness = getIntakeReadiness(partial.ctx.intakeSchema, partial.ctx.intakeState);
      return {
        status: "INTAKE_SAVED",
        saved: partial.saved,
        ignored_fields: validation.disabledFields.length ? validation.disabledFields : undefined,
        invalid_fields: validation.invalidFields.length ? validation.invalidFields : undefined,
        readiness,
        timing_ms: {
          VALIDATION_MS: validationMs,
          STATE_UPDATE_MS: partial.stateUpdateMs,
          TOTAL_MS: Date.now() - t0,
        },
      };
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

  const committed = commitNormalizedFields(ctx, validation.normalized, { validationMs, t0 });
  ctx = committed.ctx;

  void scheduleIntakePersistence({
    workspaceId,
    sessionKey,
    callControlId: callControlId || null,
    snapshot: ctx.intakeState,
    updatedAt: new Date().toISOString(),
  });

  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const ignoredFields = validation.disabledFields;

  return {
    status: "INTAKE_SAVED",
    saved: committed.saved,
    ignored_fields: ignoredFields.length ? ignoredFields : undefined,
    readiness,
    timing_ms: {
      VALIDATION_MS: validationMs,
      STATE_UPDATE_MS: committed.stateUpdateMs,
      TOTAL_MS: Date.now() - t0,
    },
  };
}
