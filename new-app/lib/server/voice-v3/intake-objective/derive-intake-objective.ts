import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isConversationalIvrRuntime } from "@/lib/receptionist/runtime-profile";
import type { VoiceV3CallContext } from "../state/call-context";
import type { IntakeObjectiveState, IntakeFieldState } from "./types";
import { defaultCollectionStrategy } from "./types";
import {
  fieldSatisfiesObjectiveRequirement,
  intakeFieldStatusFromCapture,
  verificationRequiredForField,
} from "./validate-intake-value";
import {
  configuredRequiredForOperation,
  getMissingFieldsForOperation,
  resolveActiveIntakeOperation,
  UNRESOLVED_INTAKE_OPERATION,
  type VoiceOperationName,
} from "./operation-requirements";

export function deriveIntakeObjective(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
  operationOverride?: VoiceOperationName,
): IntakeObjectiveState {
  if (isConversationalIvrRuntime(config)) {
    return {
      status: "COMPLETE",
      requiredFields: [],
      optionalFields: [],
      collectedFields: [],
      missingRequiredFields: [],
      fields: [],
    };
  }
  const values = context.intake?.values ?? {};
  const operation =
    operationOverride && operationOverride !== UNRESOLVED_INTAKE_OPERATION
      ? operationOverride
      : resolveActiveIntakeOperation(config, context);
  const requiredKeys = configuredRequiredForOperation(config, operation);
  const requiredSet = new Set(requiredKeys);

  const optionalFields = config.intakeFields
    .filter((f) => !requiredSet.has(f.key))
    .map((f) => f.key);

  const fields: IntakeFieldState[] = config.intakeFields.map((field) => {
    const captured = values[field.key];
    return {
      key: field.key,
      label: field.label,
      required: requiredSet.has(field.key),
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

  const missingRequiredFields = getMissingFieldsForOperation(operation, config, context);

  let status: IntakeObjectiveState["status"];
  if (operation === UNRESOLVED_INTAKE_OPERATION) {
    status = collectedFields.length === 0 ? "NOT_STARTED" : "IN_PROGRESS";
  } else {
    status =
      missingRequiredFields.length === 0
        ? "COMPLETE"
        : collectedFields.length === 0
          ? "NOT_STARTED"
          : "IN_PROGRESS";
  }

  return {
    status,
    requiredFields: requiredKeys,
    optionalFields,
    collectedFields,
    missingRequiredFields,
    fields,
  };
}
