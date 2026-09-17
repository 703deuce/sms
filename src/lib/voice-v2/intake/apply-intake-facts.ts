import type { IntakeFieldKey, IntakeFieldStatus, VoiceV2CallContext } from "./types";
import { validateIntakeFieldPayload } from "./validate-fields";
import { extractIntakeFieldsFromUtterance } from "./extract-intake-from-utterance";
import { rederiveWorkflowStageForContext } from "../workflow-rederive";

function nextStatus(
  previous: IntakeFieldStatus | undefined,
  isCorrection: boolean,
): IntakeFieldStatus {
  if (isCorrection) return "CORRECTED";
  if (previous === "PREFILLED") return "CAPTURED";
  if (previous === "CONFIRMED") return "CAPTURED";
  return "CAPTURED";
}

export function applyValidatedIntakeFieldsToContext(
  ctx: VoiceV2CallContext,
  normalized: Partial<Record<IntakeFieldKey, string>>,
): { ctx: VoiceV2CallContext; saved: IntakeFieldKey[] } {
  const saved: IntakeFieldKey[] = [];
  const now = new Date().toISOString();
  const nextState = { ...ctx.intakeState };

  for (const [key, value] of Object.entries(normalized)) {
    const k = key as IntakeFieldKey;
    const str = String(value ?? "").trim();
    if (!str) continue;
    const prev = nextState[k];
    const unchanged = prev?.value === str;
    if (unchanged && prev?.status !== "MISSING") continue;

    const isCorrection =
      Boolean(prev?.value?.trim()) &&
      prev!.value.trim() !== str &&
      prev!.status !== "PREFILLED" &&
      prev!.status !== "MISSING";
    nextState[k] = {
      value: str,
      status: nextStatus(prev?.status, isCorrection),
      source: "CALLER",
      updatedAt: now,
    };
    saved.push(k);
  }

  let nextCtx: VoiceV2CallContext = { ...ctx, intakeState: nextState };
  if (saved.length) {
    nextCtx = rederiveWorkflowStageForContext(nextCtx);
  }
  return { ctx: nextCtx, saved };
}

export function mergeUtteranceIntakeFactsIntoContext(
  ctx: VoiceV2CallContext,
  utterance: string,
): { ctx: VoiceV2CallContext; saved: IntakeFieldKey[] } {
  const raw = extractIntakeFieldsFromUtterance(utterance, ctx.intakeSchema);
  if (!Object.keys(raw).length) return { ctx, saved: [] };
  const validation = validateIntakeFieldPayload(ctx.intakeSchema, raw);
  if (!validation.ok && !Object.keys(validation.normalized).length) {
    return { ctx, saved: [] };
  }
  return applyValidatedIntakeFieldsToContext(ctx, validation.normalized);
}
