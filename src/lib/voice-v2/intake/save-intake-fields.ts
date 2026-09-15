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
      readiness: ReturnType<typeof getIntakeReadiness>;
      timing_ms: SaveIntakeTimingMs;
    }
  | {
      status: "INTAKE_VALIDATION_ERROR";
      invalid_fields: IntakeFieldKey[];
      disabled_fields: IntakeFieldKey[];
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

  const uStart = Date.now();
  const saved: IntakeFieldKey[] = [];
  const now = new Date().toISOString();
  const nextState = { ...ctx.intakeState };

  for (const [key, value] of Object.entries(validation.normalized)) {
    const k = key as IntakeFieldKey;
    const prev = nextState[k];
    const unchanged = prev?.value === value;
    if (unchanged && prev?.status !== "MISSING") continue;

    const isCorrection =
      Boolean(prev?.value?.trim()) &&
      prev!.value.trim() !== value.trim() &&
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

  ctx = { ...ctx, intakeState: nextState };
  setVoiceV2CallContext(ctx);
  const stateUpdateMs = Date.now() - uStart;

  void scheduleIntakePersistence({
    workspaceId,
    sessionKey,
    callControlId: callControlId || null,
    snapshot: ctx.intakeState,
    updatedAt: now,
  });

  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);

  return {
    status: "INTAKE_SAVED",
    saved,
    readiness,
    timing_ms: {
      VALIDATION_MS: validationMs,
      STATE_UPDATE_MS: stateUpdateMs,
      TOTAL_MS: Date.now() - t0,
    },
  };
}
