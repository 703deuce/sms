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
  phoneReassigned: boolean;
  realtimeModel: string;
  realtimeVoice: string;
};

export type EnsureFrontDeskRealtimeAgentInput = {
  workspaceId?: string;
  agentId?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
  /** Inbound DID to assign exclusively to frontdesk (default +18663464256). */
  phoneE164?: string;
  /** When false, skip phone reassignment (default: reassign on boot). */
  assignPhone?: boolean;
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
      agents.find((row: (typeof agents)[number]) =>
        isFrontDeskProfile(row.draftConfig?.advanced as Record<string, unknown>),
      ) ?? null;
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

  const assignPhone = input.assignPhone !== false;
  const targetE164 = (
    input.phoneE164 ||
    process.env.FRONTDESK_PHONE_E164 ||
    process.env.PHONE_E164 ||
    "+18663464256"
  ).trim();

  let phoneE164: string | null = null;
  let phoneReassigned = false;

  if (assignPhone && targetE164) {
    const { shouldSkipInboundPhoneReassignment } = await import("@/lib/voice/phone-reassignment-guard");
    const phoneGuard = await shouldSkipInboundPhoneReassignment({
      workspaceId,
      phoneE164: targetE164,
      requestingAgentId: agent.id,
    });
    if (phoneGuard.skip) {
      console.warn(
        `[frontdesk-realtime] skipping phone reassignment on ${targetE164} — ` +
          `${phoneGuard.reason} (${phoneGuard.ownerAgentName || phoneGuard.ownerAgentId})`,
      );
    }

    const phone = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: targetE164 },
      select: { id: true, e164: true },
    });
    if (phone && !phoneGuard.skip) {
      const { assignNumberToAgent } = await import("@/lib/telephony/provisioning");
      await assignNumberToAgent({
        workspaceId,
        phoneNumberId: phone.id,
        agentId: agent.id,
        exclusive: true,
      });
      phoneE164 = phone.e164;
      phoneReassigned = true;

      // Strip stale Amy (or any non-frontdesk) inbound ownership on this DID.
      const otherAssignments = await prisma.voiceAgentPhoneNumber.findMany({
        where: {
          workspaceId,
          phoneNumberId: phone.id,
          agentId: { not: agent.id },
          inboundEnabled: true,
        },
        select: { agentId: true },
      });
      if (otherAssignments.length) {
        await prisma.voiceAgentPhoneNumber.deleteMany({
          where: {
            workspaceId,
            phoneNumberId: phone.id,
            agentId: { not: agent.id },
          },
        });
        await prisma.voiceAgent.updateMany({
          where: {
            workspaceId,
            phoneNumberId: phone.id,
            id: { not: agent.id },
          },
          data: { phoneNumberId: null },
        });
      }
    } else {
      console.warn(
        `[frontdesk-realtime] phone ${targetE164} not found in ${workspaceId} — skipping reassignment`,
      );
    }
  }

  if (!phoneE164 && agent.phoneNumberId) {
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
    phoneReassigned,
    realtimeModel,
    realtimeVoice,
  };
}

/** True when the stack frontdesk profile should be upgraded on boot. */
export function isFrontDeskStackProfileValue(profile: string): boolean {
  return profile === FRONTDESK_PROFILE;
}
