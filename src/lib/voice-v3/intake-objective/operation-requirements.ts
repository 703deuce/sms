import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { fieldSatisfiesObjectiveRequirement } from "./validate-intake-value";

export type VoiceOperationName =
  | "find_availability"
  | "book_appointment"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "transfer_call"
  | "update_intake"
  | "end_call";

const READ_OPERATIONS: VoiceOperationName[] = [
  "find_availability",
  "find_appointment",
];

/** New bookings require configured intake; reschedule uses verified-appointment identity from find_appointment. */
const MUTATION_INTAKE_OPERATIONS: VoiceOperationName[] = ["book_appointment"];

function defaultRequiredIntakeKeys(config: VoiceV3AgentConfig): string[] {
  return config.intakeFields.filter((f) => f.required).map((f) => f.key);
}

function configuredRequiredForOperation(
  config: VoiceV3AgentConfig,
  operation: VoiceOperationName,
): string[] {
  const overrides = config.operationRequirements?.[operation];
  if (overrides !== undefined) return [...overrides];
  if (READ_OPERATIONS.includes(operation)) return [];
  if (MUTATION_INTAKE_OPERATIONS.includes(operation)) {
    return defaultRequiredIntakeKeys(config);
  }
  return [];
}

export function getMissingFieldsForOperation(
  operation: VoiceOperationName,
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string[] {
  const requiredKeys = configuredRequiredForOperation(config, operation);
  const values = context.intake.values;
  return requiredKeys.filter((key) => {
    const field = config.intakeFields.find((f) => f.key === key);
    if (!field) return true;
    return !fieldSatisfiesObjectiveRequirement(field, values[key]);
  });
}
