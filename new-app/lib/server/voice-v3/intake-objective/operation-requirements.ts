import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3Goal } from "../state/call-context";
import {
  getMissingCallbackRequirementKeys,
  resolveConfiguredCallbackRequiredKeys,
} from "../callback/callback-requirements";
import { resolveBookingServiceForRuntime } from "../config/resolve-booking-service";
import { resolveStoredIntakeField } from "./resolve-stored-intake";
import { fieldSatisfiesObjectiveRequirement } from "./validate-intake-value";
import { mapServiceRequiredFieldToV3IntakeKey } from "./map-service-required-field";
import type { IntakeFieldDefinition } from "../config/agent-config";

export type VoiceOperationName =
  | "unresolved"
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

/** No operation selected yet — not booking, callback, or send-link. */
export const UNRESOLVED_INTAKE_OPERATION: VoiceOperationName = "unresolved";

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
  if (operation === "unresolved") return [];
  if (operation === "request_callback") {
    return resolveConfiguredCallbackRequiredKeys(config);
  }
  if (READ_OPERATIONS.includes(operation)) return [];
  if (MUTATION_INTAKE_OPERATIONS.includes(operation)) {
    return defaultRequiredIntakeKeys(config);
  }
  if (operation === "send_booking_link") {
    return defaultRequiredIntakeKeys(config);
  }
  return [];
}

function intakeFieldForRequirementKey(
  config: VoiceV3AgentConfig,
  key: string,
): IntakeFieldDefinition | undefined {
  const direct = config.intakeFields.find((f) => f.key === key);
  if (direct) return direct;
  const normalized = mapServiceRequiredFieldToV3IntakeKey(key);
  if (normalized !== key) {
    return config.intakeFields.find((f) => f.key === normalized);
  }
  return undefined;
}

function requiredKeysForBookAppointment(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string[] {
  const globalRequired = defaultRequiredIntakeKeys(config);
  const service = resolveBookingServiceForRuntime(config, context);
  const perService = service.requiredIntakeKeys ?? [];
  const merged = new Set<string>([...globalRequired, ...perService]);
  return [...merged];
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
      return UNRESOLVED_INTAKE_OPERATION;
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
  if (operation === "unresolved") {
    return [];
  }
  if (operation === "request_callback") {
    return getMissingCallbackRequirementKeys(config, context);
  }
  const requiredKeys =
    operation === "book_appointment"
      ? requiredKeysForBookAppointment(config, context)
      : configuredRequiredForOperation(config, operation);
  const values = context.intake.values;
  return requiredKeys.filter((key) => {
    const field = intakeFieldForRequirementKey(config, key);
    if (!field) return false;
    const stored =
      resolveStoredIntakeField(values, field.key) ?? resolveStoredIntakeField(values, key);
    return !fieldSatisfiesObjectiveRequirement(field, stored);
  });
}
