import type { VoiceV3AgentConfig } from "../config/agent-config";
import { resolveVoiceV3IntakeTransport } from "../intake/intake-transport";
import { resolveVoiceV3DelegationToolSurface } from "../intake/tool-surface";
import { resolveVoiceV3AgentConfig } from "../state/call-runtime";
import { buildAstraBackendInstructions } from "./astra-backend-instructions";
import { formatBusinessLocalDateTime } from "./business-local-time";
import { buildLiveFrontendInstructions } from "./live-frontend-instructions";
import { logVoiceV3CompiledContexts } from "../config/config-observability";

export const VOICE_V3_DEFAULT_AGENT_NAME = "Amy";
export const VOICE_V3_DEFAULT_BUSINESS_NAME = "Transovo";
export const VOICE_V3_DEFAULT_BUSINESS_TIMEZONE = "America/New_York";

function serviceCatalogForAstra(config: VoiceV3AgentConfig): string {
  const services = config.services?.length ? config.services : [config.service];
  return services
    .map(
      (s) =>
        `- id=${s.id} name="${s.name}" durationMinutes=${s.durationMinutes}${s.description ? ` (${s.description})` : ""}`,
    )
    .join("\n");
}

export function buildVoiceV3Prompts(input: {
  agentName?: string;
  businessName?: string;
  timezone?: string;
  currentLocalDateTime?: string;
  agentConfig?: VoiceV3AgentConfig;
  toolNames?: string[];
}) {
  const agentConfig = input.agentConfig ?? resolveVoiceV3AgentConfig();
  const timezone =
    input.timezone ?? agentConfig.timezone ?? VOICE_V3_DEFAULT_BUSINESS_TIMEZONE;
  const currentLocalDateTime =
    input.currentLocalDateTime ?? formatBusinessLocalDateTime(timezone, new Date());
  const agentName =
    input.agentName ?? agentConfig.identity.agentName ?? VOICE_V3_DEFAULT_AGENT_NAME;
  const businessName =
    input.businessName ?? agentConfig.businessName ?? VOICE_V3_DEFAULT_BUSINESS_NAME;

  const intakeFieldCatalog = agentConfig.intakeFields
    .map(
      (f) =>
        `- ${f.key} (${f.label}, type=${f.type}, required=${f.required}${f.verificationRequired ? ", verificationRequired" : ""})`,
    )
    .join("\n");

  const liveInstructions = buildLiveFrontendInstructions({
    agentName,
    businessName,
    agentConfig,
  });

  const astraInstructions = buildAstraBackendInstructions({
    businessName,
    timezone,
    currentLocalDateTime,
    intakeFieldCatalog,
    intakeTransport: resolveVoiceV3IntakeTransport(),
    toolSurface: resolveVoiceV3DelegationToolSurface(),
    serviceCatalog: serviceCatalogForAstra(agentConfig),
    bookingStrategy: agentConfig.scheduling?.bookingStrategy,
    capabilities: agentConfig.capabilities,
    transferDestinations: agentConfig.transferDestinations,
  });

  if (input.toolNames) {
    logVoiceV3CompiledContexts({
      amySectionCount: liveInstructions.split("# ").length - 1,
      astraCharCount: astraInstructions.length,
      toolNames: input.toolNames,
    });
  }

  return {
    liveInstructions,
    astraInstructions,
  };
}

export function resolveVoiceV3DefaultPromptInput(
  now: Date = new Date(),
  agentConfig?: VoiceV3AgentConfig,
) {
  const config = agentConfig ?? resolveVoiceV3AgentConfig();
  const timezone =
    config.timezone ||
    process.env.VOICE_V3_BUSINESS_TIMEZONE?.trim() ||
    VOICE_V3_DEFAULT_BUSINESS_TIMEZONE;
  const businessName =
    config.businessName ||
    process.env.VOICE_V3_BUSINESS_NAME?.trim() ||
    VOICE_V3_DEFAULT_BUSINESS_NAME;
  const agentName =
    config.identity?.agentName ||
    process.env.VOICE_V3_AGENT_NAME?.trim() ||
    VOICE_V3_DEFAULT_AGENT_NAME;

  return {
    agentName,
    businessName,
    timezone,
    currentLocalDateTime: formatBusinessLocalDateTime(timezone, now),
    agentConfig: config,
  };
}
