import "server-only";

import { resolveVoiceV2KnownCallerState } from "./caller-field-state";
import type {
  IntakeReadinessResult,
  VoiceV2IntakeSchema,
  VoiceV2IntakeState,
} from "./types";

/** Pure deterministic evaluator — no LLM. Uses shared caller-field authority. */
export function getIntakeReadiness(
  intakeSchema: VoiceV2IntakeSchema,
  intakeState: VoiceV2IntakeState,
): IntakeReadinessResult {
  const resolved = resolveVoiceV2KnownCallerState({
    sessionKey: "",
    workspaceId: "",
    agentId: "",
    businessTimezone: "UTC",
    intakeSchema,
    intakeState,
    askedFields: {},
    compiledAt: new Date().toISOString(),
  });
  return {
    missingBeforeBooking: resolved.missingBeforeBooking,
    missingForRecord: resolved.missingForRecord,
    satisfied: resolved.known.filter((k) =>
      intakeSchema.fields.some((f) => f.key === k),
    ),
  };
}
