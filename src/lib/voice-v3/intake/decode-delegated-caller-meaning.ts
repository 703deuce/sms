import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  buildCallerMeaningZodSchema,
  configuredIntakeKeySet,
  type CallerMeaning,
} from "./caller-meaning-schema";

export type DecodeCallerMeaningLogContext = {
  callId?: string | null;
  liveSessionId?: string | null;
  stateVersion?: number;
};

type FieldRow = { key: string; value: string; confidence: number };

function logDuplicateConflict(
  ctx: DecodeCallerMeaningLogContext,
  key: string,
): void {
  console.log("VOICE_V3_DUPLICATE_FIELD_CONFLICT", {
    call_id: ctx.callId ?? null,
    live_session_id: ctx.liveSessionId ?? null,
    key,
    state_version: ctx.stateVersion ?? null,
  });
}

function logUnknownKey(ctx: DecodeCallerMeaningLogContext, key: string): void {
  console.log("VOICE_V3_UNKNOWN_INTAKE_KEY_REJECTED", {
    call_id: ctx.callId ?? null,
    live_session_id: ctx.liveSessionId ?? null,
    key,
    state_version: ctx.stateVersion ?? null,
  });
}

/**
 * Collapse duplicate keys in captured_fields; reject conflicting duplicates.
 */
function normalizeCapturedFieldRows(
  rows: FieldRow[],
  logCtx: DecodeCallerMeaningLogContext,
  allowedKeys: Set<string>,
): FieldRow[] {
  const byKey = new Map<string, FieldRow[]>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (!allowedKeys.has(key)) {
      logUnknownKey(logCtx, key);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push({ ...row, key, value: row.value.trim() });
    byKey.set(key, list);
  }

  const out: FieldRow[] = [];
  for (const [key, list] of byKey) {
    const values = new Set(list.map((r) => r.value));
    if (values.size === 1) {
      out.push(list[list.length - 1]!);
      continue;
    }
    logDuplicateConflict(logCtx, key);
  }
  return out;
}

function normalizeCorrectionRows(
  rows: Array<{ key: string; new_value: string; confidence: number }>,
  logCtx: DecodeCallerMeaningLogContext,
  allowedKeys: Set<string>,
): Array<{ key: string; new_value: string; confidence: number }> {
  const byKey = new Map<string, Array<{ key: string; new_value: string; confidence: number }>>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (!allowedKeys.has(key)) {
      logUnknownKey(logCtx, key);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push({ ...row, key, new_value: row.new_value.trim() });
    byKey.set(key, list);
  }

  const out: Array<{ key: string; new_value: string; confidence: number }> = [];
  for (const [key, list] of byKey) {
    const values = new Set(list.map((r) => r.new_value));
    if (values.size === 1) {
      out.push(list[list.length - 1]!);
      continue;
    }
    logDuplicateConflict(logCtx, key);
  }
  return out;
}

function meaningHasSignal(meaning: CallerMeaning): boolean {
  return (
    meaning.captured_fields.length > 0 ||
    meaning.corrections.length > 0 ||
    meaning.active_goal !== "UNKNOWN" ||
    Boolean(
      meaning.scheduling.requested_date_expression ||
        meaning.scheduling.requested_time_expression ||
        meaning.scheduling.requested_daypart,
    ) ||
    meaning.ambiguities.length > 0
  );
}

/**
 * Single authority: Live delegated structured JSON text → CallerMeaning.
 * JSON.parse is only used here for schema-constrained output_text.
 */
export function decodeDelegatedCallerMeaning(
  text: string,
  config: VoiceV3AgentConfig,
  logCtx: DecodeCallerMeaningLogContext = {},
): CallerMeaning | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }

  const schema = buildCallerMeaningZodSchema(config);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;

  const allowedKeys = configuredIntakeKeySet(config);
  const captured_fields = normalizeCapturedFieldRows(
    parsed.data.captured_fields,
    logCtx,
    allowedKeys,
  );
  const corrections = normalizeCorrectionRows(parsed.data.corrections, logCtx, allowedKeys);

  const meaning: CallerMeaning = {
    ...parsed.data,
    captured_fields,
    corrections,
  };

  if (!meaningHasSignal(meaning)) return null;
  return meaning;
}
