import {
  VOICE_V3_DEFAULT_BUSINESS_NAME,
  VOICE_V3_DEFAULT_BUSINESS_TIMEZONE,
} from "../prompts/build-voice-v3-prompts";
import type { VoiceV3BusinessConfig, VoiceV3IntakeFieldDefinition } from "./types";

const DEFAULT_INTAKE_FIELDS: VoiceV3IntakeFieldDefinition[] = [
  {
    key: "name",
    label: "Caller name",
    requiredBeforeBooking: true,
    requiredForRecord: true,
  },
  {
    key: "callback_phone",
    label: "Callback phone",
    requiredBeforeBooking: false,
    requiredForRecord: true,
  },
  {
    key: "service_reason",
    label: "Reason for visit",
    requiredBeforeBooking: false,
    requiredForRecord: true,
  },
];

export function resolveVoiceV3DefaultBusinessConfig(
  overrides: Partial<Pick<VoiceV3BusinessConfig, "workspaceId" | "agentId">> = {},
): VoiceV3BusinessConfig {
  const workspaceId =
    overrides.workspaceId?.trim() ||
    process.env.VOICE_V3_WORKSPACE_ID?.trim() ||
    "voice_v3_basic_default";
  const agentId =
    overrides.agentId?.trim() ||
    process.env.VOICE_V3_AGENT_ID?.trim() ||
    "voice_v3_basic_agent";
  const businessTimezone =
    process.env.VOICE_V3_BUSINESS_TIMEZONE?.trim() || VOICE_V3_DEFAULT_BUSINESS_TIMEZONE;

  return {
    workspaceId,
    agentId,
    businessTimezone,
    intakeFields: DEFAULT_INTAKE_FIELDS,
  };
}

export function formatIntakeFieldKeysForPrompt(business: VoiceV3BusinessConfig): string {
  return business.intakeFields.map((f) => `- ${f.key} (${f.label})`).join("\n");
}

export function voiceV3IntakePipelineEnabled(): boolean {
  const raw = process.env.VOICE_V3_INTAKE_ENABLED?.trim();
  if (raw === "0" || raw === "false") return false;
  return true;
}

export { VOICE_V3_DEFAULT_BUSINESS_NAME };
