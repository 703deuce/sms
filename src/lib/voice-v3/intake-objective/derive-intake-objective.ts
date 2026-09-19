import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { IntakeObjectiveState, IntakeFieldState } from "./types";
import { defaultCollectionStrategy } from "./types";
import {
  fieldSatisfiesObjectiveRequirement,
  intakeFieldStatusFromCapture,
  verificationRequiredForField,
} from "./validate-intake-value";

export function deriveIntakeObjective(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): IntakeObjectiveState {
  const values = context.intake?.values ?? {};
  const requiredFields = config.intakeFields
    .filter((f) => f.required)
    .map((f) => f.key);
  const optionalFields = config.intakeFields
    .filter((f) => !f.required)
    .map((f) => f.key);

  const fields: IntakeFieldState[] = config.intakeFields.map((field) => {
    const captured = values[field.key];
    return {
      key: field.key,
      label: field.label,
      required: field.required,
      collectionStrategy: defaultCollectionStrategy(field),
      verificationRequired: verificationRequiredForField(field),
      status: intakeFieldStatusFromCapture(field, captured),
      revision: captured?.revision ?? 0,
      hasValue: Boolean(captured?.value?.length),
    };
  });

  const collectedFields = fields
    .filter((f) => f.status !== "MISSING" && f.status !== "DECLINED")
    .map((f) => f.key);

  const missingRequiredFields = config.intakeFields
    .filter((f) => f.required)
    .filter((f) => !fieldSatisfiesObjectiveRequirement(f, values[f.key]))
    .map((f) => f.key);

  const status =
    missingRequiredFields.length === 0
      ? "COMPLETE"
      : collectedFields.length === 0
        ? "NOT_STARTED"
        : "IN_PROGRESS";

  return {
    status,
    requiredFields,
    optionalFields,
    collectedFields,
    missingRequiredFields,
    fields,
  };
}
