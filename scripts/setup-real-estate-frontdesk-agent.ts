/**
 * Create or upgrade inbound frontdesk agent to Real Estate Front Desk (OpenAI Realtime).
 *
 * Usage:
 *   npx tsx scripts/setup-real-estate-frontdesk-agent.ts
 *   PHONE_E164=+18663464256 npx tsx scripts/setup-real-estate-frontdesk-agent.ts
 */
import dotenv from "dotenv";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { assignNumberToAgent } from "@/lib/telephony/provisioning";
import { parseVoiceAgentConfig, DEFAULT_VOICE_CONFIG } from "@/lib/voice/types";
import {
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
} from "@/lib/voice/frontdesk/agent-config";
import { DEFAULT_REAL_ESTATE_BUSINESS } from "@/lib/voice/real-estate/config";

dotenv.config();

const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const AGENT_NAME = (process.env.RE_FRONTDESK_AGENT_NAME || "Real Estate Front Desk").trim();
const REALTIME_MODEL = process.env.VOICE_REALTIME_MODEL?.trim() || "gpt-realtime-2.1-mini";
const REALTIME_VOICE = process.env.VOICE_REALTIME_VOICE?.trim() || "marin";

function buildRealEstateDraftConfig(existing = DEFAULT_VOICE_CONFIG) {
  const business = DEFAULT_REAL_ESTATE_BUSINESS;
  return {
    ...existing,
    identity: {
      ...(existing.identity || {}),
      displayName: AGENT_NAME,
      businessLocation: business.businessName,
    },
    dynamicVariables: {
      ...(existing.dynamicVariables || {}),
      business_name: business.businessName,
      agent_name: AGENT_NAME,
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
        REALTIME_MODEL,
      realtimeVoice:
        process.env.VOICE_REALTIME_VOICE?.trim() ||
        (existing.advanced as Record<string, unknown> | undefined)?.realtimeVoice ||
        REALTIME_VOICE,
    },
    messaging: {
      ...(existing.messaging || {}),
      smsConfirmations: existing.messaging?.smsConfirmations !== false,
    },
  };
}

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: PHONE_E164 },
    select: { id: true, workspaceId: true, e164: true },
  });
  if (!phone) {
    throw new Error(`Phone number ${PHONE_E164} not found in database`);
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: phone.workspaceId },
    select: { id: true, name: true, draftConfig: true },
  });
  const existingRe = agents.find((row) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    const advanced = cfg.advanced as Record<string, unknown> | undefined;
    return isFrontDeskProfile(advanced) && advanced?.realEstateFrontDesk === true;
  });

  let agentId = existingRe?.id;
  let existingCfg = existingRe
    ? parseVoiceAgentConfig(existingRe.draftConfig)
    : undefined;

  if (!agentId) {
    const frontdeskFallback = agents.find((row) => {
      const cfg = parseVoiceAgentConfig(row.draftConfig);
      return isFrontDeskProfile(cfg.advanced as Record<string, unknown>);
    });
    agentId = frontdeskFallback?.id;
    existingCfg = frontdeskFallback
      ? parseVoiceAgentConfig(frontdeskFallback.draftConfig)
      : undefined;
  }

  const draftConfig = buildRealEstateDraftConfig(existingCfg || DEFAULT_VOICE_CONFIG);

  if (agentId) {
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        name: AGENT_NAME,
        displayName: AGENT_NAME,
        status: "ACTIVE",
        agentType: "appointment_booking",
        purpose: "appointment_receptionist",
        draftConfig: draftConfig as object,
      },
    });
    console.log(`Upgraded agent ${agentId} to Real Estate Front Desk (preserved existing config)`);
  } else {
    const created = await prisma.voiceAgent.create({
      data: {
        id: createId(),
        workspaceId: phone.workspaceId,
        name: AGENT_NAME,
        displayName: AGENT_NAME,
        purpose: "appointment_receptionist",
        agentType: "appointment_booking",
        status: "ACTIVE",
        draftConfig: draftConfig as object,
      },
      select: { id: true },
    });
    agentId = created.id;
    console.log(`Created Real Estate Front Desk agent ${agentId}`);
  }

  const assign = await assignNumberToAgent({
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    agentId,
    exclusive: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId,
        agentName: AGENT_NAME,
        phoneE164: phone.e164,
        livekitProfile: FRONTDESK_REALTIME_PROFILE,
        realEstateFrontDesk: true,
        assign,
        realtimeModel: draftConfig.advanced?.realtimeModel || REALTIME_MODEL,
        realtimeVoice: draftConfig.advanced?.realtimeVoice || REALTIME_VOICE,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
