import { buildAstraBackendCoreInstructions } from "./astra-backend-core-instructions";
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

  const core = buildAstraBackendCoreInstructions();
  const crossTool = buildAstraCrossToolInstructions();

  return `
${core}

Business: ${businessName}
Business timezone: ${timezone}
Current business-local date/time: ${currentLocalDateTime}

Configured intake fields (update_intake only — one key per schema property):
${context.intakeFieldCatalog ?? "(see update_intake tool schema)"}

${crossTool}

Each function tool description defines when to call, when not to call, side effects, and parameters. Follow those contracts exactly.
`.trim();
}

function buildLegacyOutputTextInstructions(context: AstraBackendPromptContext): string {
  return `
Legacy output_text transport — emit structured JSON only when explicitly required by session config.
Business: ${context.businessName ?? "the business"}
Timezone: ${context.timezone ?? "not configured"}
`.trim();
}
