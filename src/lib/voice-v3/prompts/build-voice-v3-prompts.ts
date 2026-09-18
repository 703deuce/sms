import { resolveVoiceV3IntakeTransport } from "../intake/intake-transport";
import { resolveVoiceV3AgentConfig } from "../state/call-runtime";
import { buildAstraBackendInstructions } from "./astra-backend-instructions";
import { formatBusinessLocalDateTime } from "./business-local-time";
import { buildLiveFrontendInstructions } from "./live-frontend-instructions";

export const VOICE_V3_DEFAULT_AGENT_NAME = "Amy";
export const VOICE_V3_DEFAULT_BUSINESS_NAME = "Transovo Test";
export const VOICE_V3_DEFAULT_BUSINESS_TIMEZONE = "America/New_York";

export function buildVoiceV3Prompts(input: {
  agentName?: string;
  businessName?: string;
  timezone?: string;
  currentLocalDateTime?: string;
}) {
  const timezone = input.timezone ?? VOICE_V3_DEFAULT_BUSINESS_TIMEZONE;
  const currentLocalDateTime =
    input.currentLocalDateTime ?? formatBusinessLocalDateTime(timezone);

  const agentConfig = resolveVoiceV3AgentConfig();
  const intakeFieldCatalog = agentConfig.intakeFields
    .map((f) => `- ${f.key} (${f.label}, type=${f.type}, required=${f.required})`)
    .join("\n");

  return {
    liveInstructions: buildLiveFrontendInstructions({
      agentName: input.agentName,
      businessName: input.businessName ?? agentConfig.businessName,
    }),
    astraInstructions: buildAstraBackendInstructions({
      businessName: input.businessName ?? agentConfig.businessName,
      timezone,
      currentLocalDateTime,
      intakeFieldCatalog,
      intakeTransport: resolveVoiceV3IntakeTransport(),
    }),
  };
}

export function resolveVoiceV3DefaultPromptInput(now: Date = new Date()) {
  const timezone =
    process.env.VOICE_V3_BUSINESS_TIMEZONE?.trim() || VOICE_V3_DEFAULT_BUSINESS_TIMEZONE;
  const businessName =
    process.env.VOICE_V3_BUSINESS_NAME?.trim() || VOICE_V3_DEFAULT_BUSINESS_NAME;
  const agentName =
    process.env.VOICE_V3_AGENT_NAME?.trim() || VOICE_V3_DEFAULT_AGENT_NAME;

  return {
    agentName,
    businessName,
    timezone,
    currentLocalDateTime: formatBusinessLocalDateTime(timezone, now),
  };
}
