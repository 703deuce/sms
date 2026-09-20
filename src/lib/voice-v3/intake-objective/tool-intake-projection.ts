import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { deriveIntakeObjective } from "./derive-intake-objective";
import {
  getMissingFieldsForOperation,
  resolveActiveIntakeOperation,
} from "./operation-requirements";

/** Authoritative intake snapshot for Astra tool-loop results (LiveKit has no thinking.append). */
export function buildToolIntakeProjection(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
) {
  const objective = deriveIntakeObjective(config, context);
  const activeOperation = resolveActiveIntakeOperation(config, context);
  const bookMissing = getMissingFieldsForOperation("book_appointment", config, context);

  const current_intake: Record<
    string,
    { value: string; status: string; verification_status?: string }
  > = {};
  for (const field of objective.fields) {
    const captured = context.intake.values[field.key];
    if (!captured?.value?.trim()) continue;
    current_intake[field.key] = {
      value: captured.value,
      status: field.status,
      ...(captured.verificationStatus
        ? { verification_status: captured.verificationStatus }
        : {}),
    };
  }

  return {
    current_intake,
    active_operation: activeOperation,
    missing_required_fields: objective.missingRequiredFields,
    objective_status: objective.status,
    book_appointment: {
      ready: bookMissing.length === 0,
      missing_fields: bookMissing,
    },
  };
}
