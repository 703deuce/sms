import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { deriveIntakeObjective } from "./derive-intake-objective";
import { intakeFieldObjectiveLabel } from "./validate-intake-value";
import { fieldDefinitionByKey } from "./types";
import {
  resolveActiveIntakeOperation,
  UNRESOLVED_INTAKE_OPERATION,
} from "./operation-requirements";
import { resolveStoredIntakeField } from "./resolve-stored-intake";

/** Compact objective projection for Astra/Live thinking context — not conversational commands. */
export function buildIntakeObjectiveContext(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string {
  const objective = deriveIntakeObjective(config, context);
  const operation = resolveActiveIntakeOperation(config, context);
  const unresolved = operation === UNRESOLVED_INTAKE_OPERATION;
  const objectiveDescription = unresolved
    ? "Understand what the caller needs. Shared caller facts are preserved; operation-specific requirements apply only after an operation is selected."
    : config.intake?.objectiveDescription?.trim() ||
      "Collect enough caller information to service and schedule the request.";

  const activeOperationLabel = unresolved ? "unresolved (no operation selected yet)" : operation;

  const requiredKeySet = new Set(objective.requiredFields);

  const requiredLines = config.intakeFields
    .filter((f) => requiredKeySet.has(f.key))
    .map((f) => {
      const def = fieldDefinitionByKey(config, f.key)!;
      return `- ${f.label}: ${intakeFieldObjectiveLabel(
        def,
        resolveStoredIntakeField(context.intake.values, f.key),
      )}`;
    });

  const optionalLines = config.intakeFields
    .filter((f) => !requiredKeySet.has(f.key))
    .map((f) => {
      const def = fieldDefinitionByKey(config, f.key)!;
      return `- ${f.label}: ${intakeFieldObjectiveLabel(
        def,
        resolveStoredIntakeField(context.intake.values, f.key),
      )}`;
    });

  return `
INTAKE OBJECTIVE
Purpose: ${objectiveDescription}
Active operation: ${activeOperationLabel}
Status: ${objective.status}
Required information (for this operation only):
${unresolved ? "(none — wait for the caller's intent and appropriate tool selection)" : requiredLines.join("\n") || "(none configured)"}
Optional information:
${optionalLines.join("\n") || "(none configured)"}
Rules:
- Caller facts are shared for the whole call; only missing fields for the active operation need collection.
- When the caller changes intent (for example booking to callback), stop requiring fields that belong only to the previous operation.
- Persistent caller facts belong in intake state; incomplete scheduling preferences may stay conversational until find_availability has enough to search.
- Preserve already collected information.
- Collect missing required information naturally (model decides how to ask — no scripted next question from Transovo).
- The caller may provide multiple fields at once; one caller utterance may require multiple tools when appropriate.
- Do not unnecessarily ask again for information already collected or verified.
- Email fields marked for voice verification may show as candidate until confirmed.
`.trim();
}
