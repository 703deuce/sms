import type { VoiceV3BusinessConfig, VoiceV3IntakeState } from "../call-context/types";

export interface VoiceV3IntakeReadiness {
  missingBeforeBooking: string[];
  missingForRecord: string[];
  satisfied: string[];
}

function fieldSatisfied(state: VoiceV3IntakeState, key: string): boolean {
  const row = state[key];
  if (!row?.value?.trim()) return false;
  return row.status === "CAPTURED" || row.status === "CONFIRMED" || row.status === "CORRECTED";
}

/** Pure deterministic evaluator — no LLM. */
export function getVoiceV3IntakeReadiness(
  business: VoiceV3BusinessConfig,
  intakeState: VoiceV3IntakeState,
): VoiceV3IntakeReadiness {
  const missingBeforeBooking: string[] = [];
  const missingForRecord: string[] = [];
  const satisfied: string[] = [];

  for (const field of business.intakeFields) {
    if (fieldSatisfied(intakeState, field.key)) {
      satisfied.push(field.key);
      continue;
    }
    if (field.requiredBeforeBooking) missingBeforeBooking.push(field.key);
    if (field.requiredForRecord) missingForRecord.push(field.key);
  }

  return { missingBeforeBooking, missingForRecord, satisfied };
}
