import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { deriveIntakeObjective } from "./derive-intake-objective";
import { intakeFieldStatusFromCapture } from "./validate-intake-value";
import { fieldDefinitionByKey } from "./types";

function statusLabel(status: string): string {
  switch (status) {
    case "MISSING":
      return "missing";
    case "CANDIDATE":
      return "candidate (needs confirmation)";
    case "COLLECTED":
      return "collected";
    case "VERIFIED":
      return "verified";
    case "DECLINED":
      return "declined";
    default:
      return status;
  }
}

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
      const st = intakeFieldStatusFromCapture(def, context.intake.values[f.key]);
      return `- ${f.label}: ${statusLabel(st)}`;
    });

  const optionalLines = config.intakeFields
    .filter((f) => !f.required)
    .map((f) => {
      const def = fieldDefinitionByKey(config, f.key)!;
      const st = intakeFieldStatusFromCapture(def, context.intake.values[f.key]);
      return `- ${f.label}: ${statusLabel(st)}`;
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
- Preserve already collected information.
- Collect missing required information naturally.
- The caller may provide multiple fields at once.
- Do not unnecessarily ask again for information already collected or verified.
- Candidate email values need natural confirmation before booking when verification is required.
`.trim();
}
