import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "./call-context";

export interface VoiceV3RuleEvaluation {
  missingRequiredFields: string[];
  intakeComplete: boolean;
  hasSchedulingPreference: boolean;
  mayFindAvailability: boolean;
  mayBook: boolean;
}

export function evaluateVoiceV3Rules(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
): VoiceV3RuleEvaluation {
  const missingRequiredFields = config.intakeFields
    .filter((field) => field.required)
    .filter((field) => {
      const value = ctx.intake.values[field.key]?.value;
      return !value || !value.trim();
    })
    .map((field) => field.key);

  const normalized = ctx.scheduling.normalized;
  const hasSchedulingPreference = Boolean(
    normalized &&
      normalized.precision !== "UNRESOLVED" &&
      (normalized.localDate || normalized.localStartDateTime || normalized.localEndDateTime),
  );

  return {
    missingRequiredFields,
    intakeComplete: missingRequiredFields.length === 0,
    hasSchedulingPreference,
    mayFindAvailability: false,
    mayBook: false,
  };
}
