import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3Goal } from "../state/call-context";
import {
  getMissingCallbackRequirementKeys,
  resolveConfiguredCallbackRequiredKeys,
} from "../callback/callback-requirements";
import { fieldSatisfiesObjectiveRequirement } from "./validate-intake-value";

export type VoiceOperationName =
  | "find_availability"
  | "book_appointment"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "send_booking_link"
  | "transfer_call"
  | "request_callback"
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
  if (operation === "request_callback") {
    return resolveConfiguredCallbackRequiredKeys(config);
  }
  if (READ_OPERATIONS.includes(operation)) return [];
  if (MUTATION_INTAKE_OPERATIONS.includes(operation)) {
    return defaultRequiredIntakeKeys(config);
  }
  return [];
}

/** Intake requirements follow the active dialog goal — shared facts, operation-specific gaps. */
export function resolveActiveIntakeOperation(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): VoiceOperationName {
  const goal: VoiceV3Goal = context.dialog.activeGoal;
  switch (goal) {
    case "REQUEST_CALLBACK":
      return "request_callback";
    case "RESCHEDULE_APPOINTMENT":
      return "reschedule_appointment";
    case "CANCEL_APPOINTMENT":
      return "cancel_appointment";
    case "REQUEST_TRANSFER":
      return "transfer_call";
    case "BOOK_APPOINTMENT":
      if (config.scheduling?.bookingStrategy === "SEND_LINK") {
        return "send_booking_link";
      }
      return "book_appointment";
    case "UNKNOWN":
    case "GENERAL":
    default:
      if (config.scheduling?.bookingStrategy === "SEND_LINK") {
        return "send_booking_link";
      }
      return "book_appointment";
  }
}

export function configuredRequiredKeysForActiveOperation(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string[] {
  const operation = resolveActiveIntakeOperation(config, context);
  return configuredRequiredForOperation(config, operation);
}

export function getMissingFieldsForOperation(
  operation: VoiceOperationName,
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string[] {
  if (operation === "request_callback") {
    return getMissingCallbackRequirementKeys(config, context);
  }
  const requiredKeys = configuredRequiredForOperation(config, operation);
  const values = context.intake.values;
  return requiredKeys.filter((key) => {
    const field = config.intakeFields.find((f) => f.key === key);
    if (!field) return true;
    return !fieldSatisfiesObjectiveRequirement(field, values[key]);
  });
}
