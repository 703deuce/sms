import type { VoiceV3AgentConfig } from "../types/agent-config";
import { isSendBookingLinkToolConsentRequired } from "../booking-link/send-link-consent-policy";
import { buildAstraBackendCoreInstructions } from "./astra-backend-core-instructions";
import { buildAstraCallbackInstructions } from "./astra-callback-instructions";
import { buildAstraCrossToolInstructions } from "./astra-cross-tool-instructions";
import { buildAstraIntakeInstructions } from "./astra-intake-instructions";
import { buildAstraTransferInstructions } from "./astra-transfer-instructions";
import { buildAstraKnowledgeInstructions } from "../knowledge/astra-knowledge-instructions";
import {
  buildAmySpamSolicitorInstructions,
  buildAstraSolicitorHint,
} from "../spam-protection/prompt-sections";

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
  suspectedSpamLikely?: boolean;
};

function bookingStrategyAppend(
  strategy: VoiceV3AgentConfig["scheduling"]["bookingStrategy"] | undefined,
  agentConfig?: VoiceV3AgentConfig,
): string {
  if (strategy === "REQUEST_ONLY") {
    return `
Request-only booking mode (published):
- Collect required intake naturally, then call submit_appointment_request when the caller wants an appointment.
- Do not call find_availability or book_appointment — staff will review the request.
- Do not promise a confirmed calendar time unless the business has already confirmed it outside this call.`.trim();
  }
  if (strategy === "SEND_LINK") {
    const consentGate = agentConfig && isSendBookingLinkToolConsentRequired(agentConfig);
    const consentLine = consentGate
      ? "- When the caller wants to schedule, obtain explicit SMS consent with the required verbal disclosure, then call send_booking_link with confirmed=true."
      : "- When the caller wants the booking link by text, call send_booking_link immediately (confirmed=true). The platform sends from Transovo; do not run a separate SMS consent script on the call.";
    return `
Send booking link mode (published):
${consentLine}
- Default SMS target is the inbound caller ID. Ask: "Should I text the booking link to the number you're calling from?" If yes, call send_booking_link with confirmed=true and omit destination_phone.
- If they want a different mobile number, ask for that number, then pass destination_phone using the digits they said (spoken format is fine — the system normalizes). Prefer collect_intake_field on the configured callback phone field when you need active collection.
- Do not call set_scheduling_preference, find_availability, or book_appointment for new booking intent.
- Do not collect unrelated intake solely to send the link.
- Do not pass placeholder strings (null, N/A, punctuation) in tool arguments — use JSON null or omit optional fields.
- Do not invent booking URLs or sender numbers.
- Do not tell the caller the text was sent until send_booking_link returns sent or already_sent.`.trim();
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
  const transfer = agentConfig ? buildAstraTransferInstructions(agentConfig) : "";
  const knowledge = agentConfig ? buildAstraKnowledgeInstructions(agentConfig) : null;
  const spamProtection = agentConfig?.spamProtection;
  const spamInstructions =
    spamProtection &&
    (spamProtection.solicitorPolicy || spamProtection.spamLikelyPolicy)
      ? buildAmySpamSolicitorInstructions(spamProtection, {
          suspectedSpamLikely: context.suspectedSpamLikely,
        })
      : "";
  const solicitorHint = spamProtection ? buildAstraSolicitorHint(spamProtection) : "";

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

${bookingStrategyAppend(context.bookingStrategy, agentConfig)}

${callback ? `${callback}\n\n` : ""}${intake}

${transfer ? `${transfer}\n\n` : ""}${knowledge ? `${knowledge}\n\n` : ""}${spamInstructions ? `${spamInstructions}\n\n` : ""}${solicitorHint ? `${solicitorHint}\n\n` : ""}${crossTool}

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
