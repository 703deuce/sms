import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeRealtimeNativeVoice } from "@/lib/voice/outbound/realtime-native-voices";
import {
  FRONTDESK_PROFILE,
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
  livekitProfileFromConfig,
} from "./agent-config";

export type EnsureFrontDeskRealtimeAgentResult = {
  agentId: string;
  agentName: string;
  upgraded: boolean;
  phoneE164: string | null;
  realtimeModel: string;
  realtimeVoice: string;
};

export type EnsureFrontDeskRealtimeAgentInput = {
  workspaceId?: string;
  agentId?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
};

function resolveRealtimeModel(input?: string): string {
  return (
    input?.trim() ||
    process.env.VOICE_REALTIME_MODEL?.trim() ||
    process.env.REALTIME_MODEL?.trim() ||
    "gpt-realtime-2.1-mini"
  );
}

function resolveRealtimeVoice(input?: string): string {
  const raw = input?.trim() || process.env.VOICE_REALTIME_VOICE?.trim() || "marin";
  return normalizeRealtimeNativeVoice(raw, "realtimeVoice");
}

/**
 * Upgrade the inbound frontdesk booking agent to OpenAI Realtime in place.
 * Keeps the same agent id and phone assignment — only changes livekitProfile + realtime settings.
 */
export async function ensureFrontDeskRealtimeAgent(
  input: EnsureFrontDeskRealtimeAgentInput = {},
): Promise<EnsureFrontDeskRealtimeAgentResult> {
  const workspaceId = input.workspaceId?.trim() || process.env.WORKSPACE_ID?.trim() || "ws_1";
  const realtimeModel = resolveRealtimeModel(input.realtimeModel);
  const realtimeVoice = resolveRealtimeVoice(input.realtimeVoice);

  const prisma = getPrisma();

  let agent = input.agentId?.trim()
    ? await prisma.voiceAgent.findFirst({
        where: { id: input.agentId.trim(), workspaceId },
        select: {
          id: true,
          name: true,
          draftConfig: true,
          phoneNumberId: true,
        },
      })
    : null;

  if (!agent) {
    const agents = await prisma.voiceAgent.findMany({
      where: { workspaceId },
      select: { id: true, name: true, draftConfig: true, phoneNumberId: true },
    });
    agent =
      agents.find((row) => isFrontDeskProfile(row.draftConfig?.advanced as Record<string, unknown>)) ??
      null;
  }

  if (!agent) {
    throw new Error(
      `No frontdesk booking agent found in ${workspaceId} — run setup:frontdesk-booking-agent first`,
    );
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const profile = livekitProfileFromConfig(config.advanced as Record<string, unknown>);
  const upgraded = profile !== FRONTDESK_REALTIME_PROFILE;

  const draftConfig = {
    ...config,
    advanced: {
      ...(config.advanced || {}),
      livekitProfile: FRONTDESK_REALTIME_PROFILE,
      realtimeModel,
      realtimeVoice,
    },
    messaging: {
      ...(config.messaging || {}),
      smsConfirmations: config.messaging?.smsConfirmations !== false,
    },
  };

  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: {
      draftConfig: draftConfig as object,
      status: "ACTIVE",
      agentType: "appointment_booking",
      purpose: "appointment_receptionist",
    },
  });

  let phoneE164: string | null = null;
  if (agent.phoneNumberId) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    phoneE164 = phone?.e164 || null;
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    upgraded,
    phoneE164,
    realtimeModel,
    realtimeVoice,
  };
}

/** True when the stack frontdesk profile should be upgraded on boot. */
export function isFrontDeskStackProfileValue(profile: string): boolean {
  return profile === FRONTDESK_PROFILE;
}
