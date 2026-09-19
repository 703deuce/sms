import type { VoiceV3AgentConfig } from "../config/agent-config";
import { buildAstraBackendCoreInstructions } from "./astra-backend-core-instructions";
import { buildAstraCallbackInstructions } from "./astra-callback-instructions";
import { buildAstraCrossToolInstructions } from "./astra-cross-tool-instructions";
import { buildAstraIntakeInstructions } from "./astra-intake-instructions";

export type AstraBackendPromptContext = {
  businessName?: string;
  timezone?: string;
  currentLocalDateTime?: string;
  intakeFieldCatalog?: string;
  toolSurface?: "capability_tools" | "output_text";
  intakeTransport?: string;
  serviceCatalog?: string;
  bookingStrategy?: VoiceV3AgentConfig["scheduling"]["bookingStrategy"];
  capabilities?: VoiceV3AgentConfig["capabilities"];
  transferDestinations?: VoiceV3AgentConfig["transferDestinations"];
  agentConfig?: VoiceV3AgentConfig;
};

function bookingStrategyAppend(
  strategy: VoiceV3AgentConfig["scheduling"]["bookingStrategy"] | undefined,
): string {
  if (strategy === "SEND_LINK") {
    return `
Send booking link mode (published):
- When the caller wants to schedule, obtain explicit SMS consent with the required verbal disclosure, then call send_booking_link with confirmed=true.
- Do not call set_scheduling_preference, find_availability, or book_appointment for new booking intent.
- Do not collect booking intake fields (name, email, service, date, time) solely to send the link.
- Do not invent booking URLs or sender numbers.`.trim();
  }
  return "";
}

export function buildAstraBackendInstructions(
  context: AstraBackendPromptContext = {},
): string {
  const businessName = context.businessName ?? "the business";
  const timezone = context.timezone ?? "not yet configured";
  const currentLocalDateTime = context.currentLocalDateTime ?? "not yet provided";

  if (context.toolSurface === "output_text") {
    return buildLegacyOutputTextInstructions(context);
  }

  const agentConfig = context.agentConfig;
  const core = buildAstraBackendCoreInstructions();
  const callback = agentConfig ? buildAstraCallbackInstructions(agentConfig) : "";
  const crossTool = buildAstraCrossToolInstructions(agentConfig);
  const intake = buildAstraIntakeInstructions();

  return `
${core}

Business: ${businessName}
Business timezone: ${timezone}
Current business-local date/time: ${currentLocalDateTime}

Configured intake fields (update_intake only — one key per schema property):
${context.intakeFieldCatalog ?? "(see update_intake tool schema)"}

Bookable services (use id for booking_service_id / match service_reason by name):
${context.serviceCatalog ?? "(single default service)"}

Booking strategy: ${context.bookingStrategy ?? "MICROSOFT_365"}

${bookingStrategyAppend(context.bookingStrategy)}

${callback ? `${callback}\n\n` : ""}${intake}

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
