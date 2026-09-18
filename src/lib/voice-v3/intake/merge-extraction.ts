import type { VoiceV3CallContext, VoiceV3IntakeFieldValue } from "../call-context/types";
import type { VoiceV3IntakeExtraction } from "./extraction-schema";

export interface MergeIntakeExtractionResult {
  context: VoiceV3CallContext;
  appliedKeys: string[];
  ignoredKeys: string[];
  extractionGeneration: number;
}

function isKnownFieldKey(ctx: VoiceV3CallContext, key: string): boolean {
  return ctx.business.intakeFields.some((f) => f.key === key);
}

/**
 * Deterministic merge of Astra Structured Output into authoritative CallContext.
 * Does not call OpenAI — safe for unit tests and executor callbacks.
 */
export function mergeIntakeExtractionIntoCallContext(
  ctx: VoiceV3CallContext,
  extraction: VoiceV3IntakeExtraction,
  at: Date = new Date(),
): MergeIntakeExtractionResult {
  const extractionGeneration = ctx.generations.extraction + 1;
  const intakeState = { ...ctx.intakeState };
  const appliedKeys: string[] = [];
  const ignoredKeys: string[] = [];
  const updatedAt = at.toISOString();

  for (const update of extraction.field_updates) {
    const key = update.key.trim();
    if (!key) continue;
    if (!isKnownFieldKey(ctx, key)) {
      ignoredKeys.push(key);
      continue;
    }

    const value = update.value.trim();
    if (!value) {
      ignoredKeys.push(key);
      continue;
    }

    const status = update.status ?? "CAPTURED";
    const next: VoiceV3IntakeFieldValue = {
      value,
      status,
      source: "ASTRA_STRUCTURED",
      updatedAt,
      evidence: update.evidence?.trim() || undefined,
      extractionGeneration,
    };

    intakeState[key] = next;
    appliedKeys.push(key);
  }

  const context: VoiceV3CallContext = {
    ...ctx,
    intakeState,
    generations: {
      ...ctx.generations,
      extraction: extractionGeneration,
    },
  };

  return {
    context,
    appliedKeys,
    ignoredKeys,
    extractionGeneration,
  };
}
