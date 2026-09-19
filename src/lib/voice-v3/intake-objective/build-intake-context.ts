import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { deriveIntakeObjective } from "./derive-intake-objective";
import { intakeFieldObjectiveLabel } from "./validate-intake-value";
import { fieldDefinitionByKey } from "./types";

/** Compact objective projection for Astra/Live thinking context — not conversational commands. */
export function buildIntakeObjectiveContext(
  config: VoiceV3AgentConfig,
  context: VoiceV3CallContext,
): string {
  const objective = deriveIntakeObjective(config, context);
  const objectiveDescription =
    config.intake?.objectiveDescription?.trim() ||
    "Collect enough caller information to service and schedule the request.";

  const requiredLines = config.intakeFields
    .filter((f) => f.required)
    .map((f) => {
      const def = fieldDefinitionByKey(config, f.key)!;
      return `- ${f.label}: ${intakeFieldObjectiveLabel(def, context.intake.values[f.key])}`;
    });

  const optionalLines = config.intakeFields
    .filter((f) => !f.required)
    .map((f) => {
      const def = fieldDefinitionByKey(config, f.key)!;
      return `- ${f.label}: ${intakeFieldObjectiveLabel(def, context.intake.values[f.key])}`;
    });

  return `
INTAKE OBJECTIVE
Purpose: ${objectiveDescription}
Status: ${objective.status}
Required information:
${requiredLines.join("\n") || "(none configured)"}
Optional information:
${optionalLines.join("\n") || "(none configured)"}
Rules:
- Persistent caller facts belong in intake state; incomplete scheduling preferences may stay conversational until find_availability has enough to search.
- Preserve already collected information.
- Collect missing required information naturally (model decides how to ask — no scripted next question from Transovo).
- The caller may provide multiple fields at once; one caller utterance may require multiple tools when appropriate.
- Do not unnecessarily ask again for information already collected or verified.
- Email fields marked for voice verification may show as candidate until confirmed.
`.trim();
}
