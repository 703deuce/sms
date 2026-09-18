import type { VoiceV3CallContext } from "../call-context/types";
import { getVoiceV3CallContext, setVoiceV3CallContext } from "../call-context/session-store";
import type { VoiceV3IntakeExtraction } from "./extraction-schema";
import { mergeIntakeExtractionIntoCallContext } from "./merge-extraction";
import {
  buildSessionThinkingAppendCommand,
  buildVoiceV3IntakeThinkingSnapshot,
} from "./thinking-snapshot";

export type ApplyDelegatedIntakeResult =
  | { applied: false; reason: string }
  | {
      applied: true;
      context: VoiceV3CallContext;
      appliedKeys: string[];
      ignoredKeys: string[];
      thinkingCommand: ReturnType<typeof buildSessionThinkingAppendCommand>;
    };

export function applyDelegatedIntakeExtraction(input: {
  liveSessionId: string;
  extraction: VoiceV3IntakeExtraction;
}): ApplyDelegatedIntakeResult {
  const existing = getVoiceV3CallContext(input.liveSessionId);
  if (!existing) {
    return { applied: false, reason: "missing_call_context" };
  }

  const merged = mergeIntakeExtractionIntoCallContext(existing, input.extraction);
  setVoiceV3CallContext(merged.context);

  const thinkingCommand = buildSessionThinkingAppendCommand(
    buildVoiceV3IntakeThinkingSnapshot(merged.context),
  );

  console.log("VOICE_V3_INTAKE_MERGED", {
    liveSessionId: input.liveSessionId,
    extractionGeneration: merged.extractionGeneration,
    appliedKeys: merged.appliedKeys,
    ignoredKeys: merged.ignoredKeys,
    callerIntent: input.extraction.caller_intent ?? null,
  });

  return {
    applied: true,
    context: merged.context,
    appliedKeys: merged.appliedKeys,
    ignoredKeys: merged.ignoredKeys,
    thinkingCommand,
  };
}
