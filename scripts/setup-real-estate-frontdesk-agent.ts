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
  const existing = agents.find((row) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    const advanced = cfg.advanced as Record<string, unknown> | undefined;
    return isFrontDeskProfile(advanced) && advanced?.realEstateFrontDesk === true;
  });

  const business = DEFAULT_REAL_ESTATE_BUSINESS;
  const draftConfig = {
    ...DEFAULT_VOICE_CONFIG,
    identity: {
      ...DEFAULT_VOICE_CONFIG.identity,
      displayName: AGENT_NAME,
      businessLocation: business.businessName,
    },
    dynamicVariables: {
      business_name: business.businessName,
      agent_name: AGENT_NAME,
      service_areas: business.serviceAreas,
      property_types: business.propertyTypes,
      knowledge_notes: business.knowledgeNotes,
      authority_boundaries: business.authorityBoundaries,
    },
    advanced: {
      ...(DEFAULT_VOICE_CONFIG.advanced || {}),
      livekitProfile: FRONTDESK_REALTIME_PROFILE,
      realEstateFrontDesk: true,
      vertical: "real_estate",
      realtimeModel: REALTIME_MODEL,
      realtimeVoice: REALTIME_VOICE,
    },
    messaging: {
      ...(DEFAULT_VOICE_CONFIG.messaging || {}),
      smsConfirmations: true,
    },
  };

  let agentId = existing?.id;
  if (!agentId) {
    const frontdeskFallback = agents.find((row) => {
      const cfg = parseVoiceAgentConfig(row.draftConfig);
      return isFrontDeskProfile(cfg.advanced as Record<string, unknown>);
    });
    agentId = frontdeskFallback?.id;
  }

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
    console.log(`Upgraded agent ${agentId} to Real Estate Front Desk`);
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
        realtimeModel: REALTIME_MODEL,
        realtimeVoice: REALTIME_VOICE,
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
