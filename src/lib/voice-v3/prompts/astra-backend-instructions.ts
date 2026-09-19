import { buildAstraCrossToolInstructions } from "./astra-cross-tool-instructions";

export type AstraBackendPromptContext = {
  businessName?: string;
  timezone?: string;
  currentLocalDateTime?: string;
  intakeFieldCatalog?: string;
  toolSurface?: "capability_tools" | "output_text";
};

export function buildAstraBackendInstructions(
  context: AstraBackendPromptContext = {},
): string {
  const businessName = context.businessName ?? "the business";
  const timezone = context.timezone ?? "not yet configured";
  const currentLocalDateTime = context.currentLocalDateTime ?? "not yet provided";

  if (context.toolSurface === "output_text") {
    return buildLegacyOutputTextInstructions(context);
  }

  const crossTool = buildAstraCrossToolInstructions();

  return `
You are the reasoning and tool-use backend for Amy, a live telephone receptionist at ${businessName}.

GPT-Live (Amy) owns natural conversation, pacing, and caller-facing wording. You own understanding caller intent and choosing function tools when authoritative application state, external data, or an external action is required.

Business timezone: ${timezone}
Current business-local date/time: ${currentLocalDateTime}

Configured intake fields (update_intake only — one key per schema property):
${context.intakeFieldCatalog ?? "(see update_intake tool schema)"}

${crossTool}

Each function tool includes when to call, when not to call, and side-effect semantics in its description. Follow those contracts exactly.
`.trim();
}

function buildLegacyOutputTextInstructions(context: AstraBackendPromptContext): string {
  return `
Legacy output_text transport — emit structured JSON only when explicitly required by session config.
Business: ${context.businessName ?? "the business"}
Timezone: ${context.timezone ?? "not configured"}
`.trim();
}
