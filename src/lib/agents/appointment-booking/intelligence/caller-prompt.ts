/**
 * Caller Amy — modular prompt compiler with dynamic custom fields.
 */

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { buildSystemPromptLegacy } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import {
  normalizeWizardCollectFields,
  type AgentCollectionField,
} from "@/lib/agents/appointment-booking/collection-fields";
import { compileVoiceAgentPromptFromWizard } from "@/lib/voice/prompt/compile-voice-agent-prompt";

export function formatCustomFieldsForPrompt(fields: AgentCollectionField[]): string {
  const enabled = fields.filter((f) => f.enabled);
  if (!enabled.length) return "No custom collection fields beyond defaults.";
  return enabled
    .sort((a, b) => a.askOrder - b.askOrder)
    .map((f) => {
      const req = f.required ? "required" : "optional";
      const confirm = f.confirmationRequired ? "; confirm before saving" : "";
      const applies = f.appliesToServiceIds?.length
        ? `; applies to services: ${f.appliesToServiceIds.join(", ")}`
        : "";
      return `- ${f.label} (${f.type}, ${req}): ask "${f.question || f.label}"${confirm}${applies}; save to ${(f.saveTo || []).join(", ")}`;
    })
    .join("\n");
}

export function buildCallerAmyPromptFromModules(
  state: AppointmentReceptionistWizardState,
): string {
  return compileVoiceAgentPromptFromWizard(state);
}

export function compileCustomFieldTestFixtures(fields: AgentCollectionField[]): Array<{
  fieldKey: string;
  sampleQuestion: string;
  sampleValidValue: string;
  sampleInvalidValue?: string;
}> {
  return fields
    .filter((f) => f.enabled)
    .map((f) => ({
      fieldKey: f.key,
      sampleQuestion: f.question || f.label,
      sampleValidValue:
        f.type === "email"
          ? "caller@example.com"
          : f.type === "phone"
            ? "+15551234567"
            : f.type === "address"
              ? "123 Main St"
              : "sample value",
      sampleInvalidValue: f.type === "email" ? "not-an-email" : undefined,
    }));
}
