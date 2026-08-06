/**
 * Caller Amy — modular prompt compiler with dynamic custom fields.
 */

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  buildBusinessKnowledgePromptSection,
  buildSystemPromptLegacy,
} from "@/lib/solutions/appointment-receptionist/build-agent-config";
import {
  normalizeWizardCollectFields,
  type AgentCollectionField,
} from "@/lib/agents/appointment-booking/collection-fields";
import { compilePromptModules, CALLER_AMY_DEFAULT_MODULES } from "./prompt-modules";

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
  const fields = normalizeWizardCollectFields(state.collectFields);
  const businessKnowledge = buildBusinessKnowledgePromptSection(state);
  const transferSummary = state.transferDestinationName
    ? `Transfer to ${state.transferDestinationName}${state.transferDestinationPhone ? ` (${state.transferDestinationPhone})` : ""} when policy requires.`
    : "Transfer per AgentVersion transfer policy.";

  const bookingSummary = [
    `Booking: ${state.capabilities.includes("book_appointments") ? "enabled" : "disabled"}.`,
    `Final confirmation: ${state.bookingBehavior.confirmBeforeBooking ? "required" : "not required"}.`,
    `SMS confirmation: ${state.bookingBehavior.sendSmsAfterBooking ? "enabled" : "disabled"}.`,
  ].join(" ");

  const modulePrompt = compilePromptModules({
    modules: CALLER_AMY_DEFAULT_MODULES,
    context: {
      agentName: state.agentName || "Amy",
      businessName: state.businessName || "the business",
      timezone: state.timezone || "America/New_York",
      bookingPolicySummary: bookingSummary,
      customFieldsSummary: formatCustomFieldsForPrompt(fields),
      transferPolicySummary: transferSummary,
      fallbackPolicySummary: `On transfer failure: ${state.transferFallback.replaceAll("_", " ")}.`,
      businessKnowledge,
    },
  });

  // Append legacy detailed sections (date/time tools, goals, privacy) for parity
  const legacy = buildSystemPromptLegacy(state);
  const legacyTail = legacy.split("Goals:").slice(1).join("Goals:");
  if (legacyTail) {
    return `${modulePrompt}\n\nGoals:${legacyTail}`;
  }
  return modulePrompt;
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
