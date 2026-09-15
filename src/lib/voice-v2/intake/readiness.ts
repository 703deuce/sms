import "server-only";

import type {
  IntakeFieldKey,
  IntakeFieldValue,
  IntakeReadinessResult,
  VoiceV2IntakeSchema,
  VoiceV2IntakeState,
} from "./types";

function hasUsableValue(field?: IntakeFieldValue): boolean {
  if (!field?.value?.trim()) return false;
  if (field.status === "MISSING") return false;
  return true;
}

/** Pure deterministic evaluator — no LLM. */
export function getIntakeReadiness(
  intakeSchema: VoiceV2IntakeSchema,
  intakeState: VoiceV2IntakeState,
): IntakeReadinessResult {
  const missingBeforeBooking: IntakeFieldKey[] = [];
  const missingForRecord: IntakeFieldKey[] = [];
  const satisfied: IntakeFieldKey[] = [];

  for (const field of intakeSchema.fields) {
    const val = intakeState[field.key];
    if (hasUsableValue(val)) {
      satisfied.push(field.key);
      continue;
    }
    if (field.requirementLevel === "REQUIRED_BEFORE_BOOKING") {
      missingBeforeBooking.push(field.key);
    } else if (field.requirementLevel === "REQUIRED_FOR_RECORD") {
      missingForRecord.push(field.key);
    }
  }

  return { missingBeforeBooking, missingForRecord, satisfied };
}
