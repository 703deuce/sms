/** @deprecated Production PSTN path — use merge-intake-state / tool handlers. Tests may import apply-caller-meaning directly. */
export { applyCallerMeaningToContext, type ApplyCallerMeaningResult } from "./apply-caller-meaning";
export {
  applyIntakeToolPatch,
  mergeDialogActiveGoalFromTool,
  mergeIntakeFieldValues,
  mergeSchedulingNaturalLanguage,
  type IntakeMergeResult,
} from "./merge-intake-state";
export {
  buildCallerInterpretationContext,
  formatCallerInterpretationContextJson,
  type CallerInterpretationContext,
} from "./caller-meaning";
export {
  buildCallerMeaningZodSchema,
  CALLER_MEANING_STRUCTURED_OUTPUT_NAME,
  configuredIntakeKeySet,
  type CallerMeaning,
} from "./caller-meaning-schema";
export {
  decodeCallerMeaningFromFunctionArguments,
  decodeDelegatedCallerMeaning,
  validateCallerMeaningFromRaw,
  type DecodeCallerMeaningLogContext,
} from "./decode-delegated-caller-meaning";
export { resolveVoiceV3IntakeTransport, type VoiceV3IntakeTransport } from "./intake-transport";
export {
  assertLiveDelegationAcceptPayloadCompatible,
  buildVoiceV3AstraDelegationResponses,
  validateAndLogLiveAcceptDelegationPayload,
  voiceV3CallerMeaningTextFormat,
} from "./delegation-config";
export {
  clearDelegatedMeaningSessionState,
  handleDelegatedAstraResponseEvent,
} from "./handle-delegated-meaning";
