import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { assignNumberToAgent } from "@/lib/telephony/provisioning";
import { parseVoiceAgentConfig, DEFAULT_VOICE_CONFIG } from "@/lib/voice/types";
import {
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
} from "@/lib/voice/frontdesk/agent-config";
import { DEFAULT_REAL_ESTATE_BUSINESS } from "./config";

export type EnsureRealEstateFrontDeskAgentInput = {
  workspaceId?: string;
  phoneE164?: string;
  agentName?: string;
  assignPhone?: boolean;
};

export type EnsureRealEstateFrontDeskAgentResult = {
  ok: boolean;
  agentId: string;
  agentName: string;
  phoneE164: string | null;
  created: boolean;
  upgraded: boolean;
};

function resolvePhoneE164(input?: string): string {
  return (
    input?.trim() ||
    process.env.FRONTDESK_PHONE_E164?.trim() ||
    process.env.PHONE_E164?.trim() ||
    "+18663464256"
  );
}

function resolveAgentName(input?: string): string {
  return (input?.trim() || process.env.RE_FRONTDESK_AGENT_NAME?.trim() || "Real Estate Front Desk").trim();
}

export function buildRealEstateDraftConfig(
  existing = DEFAULT_VOICE_CONFIG,
  agentName = resolveAgentName(),
) {
  const business = DEFAULT_REAL_ESTATE_BUSINESS;
  return {
    ...existing,
    identity: {
      ...(existing.identity || {}),
      displayName: agentName,
      businessLocation: business.businessName,
    },
    dynamicVariables: {
      ...(existing.dynamicVariables || {}),
      business_name: business.businessName,
      agent_name: agentName,
      service_areas: business.serviceAreas,
      property_types: business.propertyTypes,
      knowledge_notes: business.knowledgeNotes,
      authority_boundaries: business.authorityBoundaries,
    },
    advanced: {
      ...(existing.advanced || {}),
      livekitProfile: FRONTDESK_REALTIME_PROFILE,
      realEstateFrontDesk: true,
      vertical: "real_estate",
      realtimeModel:
        process.env.VOICE_REALTIME_MODEL?.trim() ||
        (existing.advanced as Record<string, unknown> | undefined)?.realtimeModel ||
        "gpt-realtime-2.1-mini",
      realtimeVoice:
        process.env.VOICE_REALTIME_VOICE?.trim() ||
        (existing.advanced as Record<string, unknown> | undefined)?.realtimeVoice ||
        "marin",
    },
    messaging: {
      ...(existing.messaging || {}),
      smsConfirmations: existing.messaging?.smsConfirmations !== false,
    },
  };
}

/**
 * Idempotently create or upgrade the inbound Real Estate Front Desk voice agent.
 * Safe to call on every deploy — preserves existing draftConfig fields.
 */
export async function ensureRealEstateFrontDeskAgent(
  input: EnsureRealEstateFrontDeskAgentInput = {},
): Promise<EnsureRealEstateFrontDeskAgentResult> {
  const prisma = getPrisma();
  const workspaceId = input.workspaceId?.trim() || process.env.WORKSPACE_ID?.trim() || "ws_1";
  const phoneE164 = resolvePhoneE164(input.phoneE164);
  const agentName = resolveAgentName(input.agentName);
  const assignPhone = input.assignPhone !== false;

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: phoneE164 },
    select: { id: true, e164: true },
  });
  if (!phone && assignPhone) {
    throw new Error(`Phone number ${phoneE164} not found in workspace ${workspaceId}`);
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, draftConfig: true },
  });

  const existingRe = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    const advanced = cfg.advanced as Record<string, unknown> | undefined;
    return isFrontDeskProfile(advanced) && advanced?.realEstateFrontDesk === true;
  });

  let agentId = existingRe?.id;
  let existingCfg = existingRe ? parseVoiceAgentConfig(existingRe.draftConfig) : undefined;
  let created = false;

  if (!agentId) {
    const frontdeskFallback = agents.find((row: (typeof agents)[number]) => {
      const cfg = parseVoiceAgentConfig(row.draftConfig);
      return isFrontDeskProfile(cfg.advanced as Record<string, unknown>);
    });
    agentId = frontdeskFallback?.id;
    existingCfg = frontdeskFallback ? parseVoiceAgentConfig(frontdeskFallback.draftConfig) : undefined;
  }

  const draftConfig = buildRealEstateDraftConfig(existingCfg || DEFAULT_VOICE_CONFIG, agentName);

  if (agentId) {
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        name: agentName,
        displayName: agentName,
        status: "ACTIVE",
        agentType: "appointment_booking",
        purpose: "appointment_receptionist",
        draftConfig: draftConfig as object,
      },
    });
  } else {
    const createdRow = await prisma.voiceAgent.create({
      data: {
        id: createId(),
        workspaceId,
        name: agentName,
        displayName: agentName,
        purpose: "appointment_receptionist",
        agentType: "appointment_booking",
        status: "ACTIVE",
        draftConfig: draftConfig as object,
      },
      select: { id: true },
    });
    agentId = createdRow.id;
    created = true;
  }

  if (assignPhone && phone) {
    await assignNumberToAgent({
      workspaceId,
      phoneNumberId: phone.id,
      agentId,
      exclusive: true,
    });
  }

  return {
    ok: true,
    agentId,
    agentName,
    phoneE164: phone?.e164 || phoneE164,
    created,
    upgraded: !created,
  };
}
