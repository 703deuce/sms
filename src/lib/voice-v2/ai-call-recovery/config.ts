import "server-only";

import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG,
  DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES,
  DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TRIGGERS,
  type VoiceV2AiCallRecoveryConfig,
  type VoiceV2AiCallRecoveryConsentMode,
} from "./types";

function parseConsentMode(raw: unknown): VoiceV2AiCallRecoveryConsentMode {
  const v = String(raw || "").trim();
  if (v === "EXISTING_CONSENT" || v === "PLATFORM_CAPTURED_CONSENT" || v === "DISABLED") {
    return v;
  }
  return "DISABLED";
}

export function parseVoiceV2AiCallRecoveryConfig(
  advanced: Record<string, unknown> | null | undefined,
): VoiceV2AiCallRecoveryConfig {
  const raw = advanced?.voiceV2AiCallRecovery;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG };
  }
  const o = raw as Record<string, unknown>;
  const templatesRaw = (o.templates as Record<string, unknown>) || {};
  const triggersRaw = (o.triggers as Record<string, unknown>) || {};

  return {
    enabled: o.enabled === true,
    consentMode: parseConsentMode(o.consentMode),
    sendingPhoneNumberId:
      typeof o.sendingPhoneNumberId === "string" ? o.sendingPhoneNumberId : null,
    continueOverSms: o.continueOverSms !== false,
    triggers: {
      ...DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TRIGGERS,
      silentAbandonment: triggersRaw.silentAbandonment !== false,
      partialIntake: triggersRaw.partialIntake !== false,
      bookingInterrupted: triggersRaw.bookingInterrupted !== false,
      providerFailure: triggersRaw.providerFailure !== false,
      transferInterrupted: triggersRaw.transferInterrupted !== false,
      transferFailed: triggersRaw.transferFailed !== false,
      declinedAi: triggersRaw.declinedAi !== false,
      generalUnresolved: triggersRaw.generalUnresolved === true,
    },
    sendWhenCallbackAlreadyCreated: o.sendWhenCallbackAlreadyCreated === true,
    delaySeconds: Number.isFinite(Number(o.delaySeconds))
      ? Math.max(0, Math.min(30, Number(o.delaySeconds)))
      : 0,
    templates: {
      ...DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES,
      silentAbandonment:
        String(templatesRaw.silentAbandonment || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.silentAbandonment,
      partialIntake:
        String(templatesRaw.partialIntake || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.partialIntake,
      bookingInterrupted:
        String(templatesRaw.bookingInterrupted || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.bookingInterrupted,
      transferInterrupted:
        String(templatesRaw.transferInterrupted || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.transferInterrupted,
      providerFailure:
        String(templatesRaw.providerFailure || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.providerFailure,
      aiChannelDeclined:
        String(templatesRaw.aiChannelDeclined || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.aiChannelDeclined,
      generalUnresolved:
        String(templatesRaw.generalUnresolved || "").trim() ||
        DEFAULT_VOICE_V2_AI_CALL_RECOVERY_TEMPLATES.generalUnresolved,
    },
    afterHoursRecoveryEnabled: o.afterHoursRecoveryEnabled === true,
    recoveryCooldownSeconds: Number.isFinite(Number(o.recoveryCooldownSeconds))
      ? Math.max(60, Number(o.recoveryCooldownSeconds))
      : DEFAULT_VOICE_V2_AI_CALL_RECOVERY_CONFIG.recoveryCooldownSeconds,
  };
}

export async function loadVoiceV2AiCallRecoveryConfigForAgent(input: {
  workspaceId: string;
  agentId?: string | null;
  agentVersionId?: string | null;
}): Promise<VoiceV2AiCallRecoveryConfig> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  let configRaw: unknown = null;
  if (input.agentVersionId) {
    const ver = await prisma.voiceAgentVersion.findFirst({
      where: { id: input.agentVersionId, workspaceId: input.workspaceId },
      select: { config: true },
    });
    configRaw = ver?.config;
  } else if (input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: {
        publishedVersion: { select: { config: true } },
        draftConfig: true,
      },
    });
    configRaw = agent?.publishedVersion?.config ?? agent?.draftConfig;
  }
  const parsed = configRaw ? parseVoiceAgentConfig(configRaw) : null;
  const advanced = (parsed?.advanced || {}) as Record<string, unknown>;
  return parseVoiceV2AiCallRecoveryConfig(advanced);
}
