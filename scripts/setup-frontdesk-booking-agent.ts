/**
 * Create a front-desk booking VoiceAgent (LiveKit frontdesk profile) and assign a DID.
 *
 * Usage:
 *   npx tsx scripts/setup-frontdesk-booking-agent.ts
 *   PHONE_E164=+18663464256 npx tsx scripts/setup-frontdesk-booking-agent.ts
 */
import dotenv from "dotenv";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { assignNumberToAgent } from "@/lib/telephony/provisioning";
import { parseVoiceAgentConfig, DEFAULT_VOICE_CONFIG } from "@/lib/voice/types";

dotenv.config();

const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const AGENT_NAME = (process.env.FRONTDESK_AGENT_NAME || "Front Desk Booking").trim();

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
    select: { id: true, name: true, phoneNumberId: true, draftConfig: true },
  });
  const existing = agents.find((row) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return cfg.advanced?.livekitProfile === "frontdesk";
  });

  let agentId = existing?.id;

  if (!agentId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: phone.workspaceId },
      select: { name: true },
    });
    const businessName = ws?.name?.trim() || "our office";
    const draftConfig = {
      ...DEFAULT_VOICE_CONFIG,
      identity: {
        ...DEFAULT_VOICE_CONFIG.identity,
        displayName: AGENT_NAME,
        businessLocation: businessName,
      },
      dynamicVariables: {
        business_name: businessName,
        agent_name: AGENT_NAME,
      },
      advanced: {
        ...(DEFAULT_VOICE_CONFIG.advanced || {}),
        livekitProfile: "frontdesk",
      },
      messaging: {
        ...(DEFAULT_VOICE_CONFIG.messaging || {}),
        smsConfirmations: true,
      },
    };

    const created = await prisma.voiceAgent.create({
      data: {
        id: createId(),
        workspaceId: phone.workspaceId,
        name: AGENT_NAME,
        displayName: AGENT_NAME,
        purpose: "appointment_receptionist",
        agentType: "appointment_booking",
        status: "ACTIVE",
        draftConfig,
      },
      select: { id: true },
    });
    agentId = created.id;
    console.log(`Created frontdesk agent ${agentId} (${AGENT_NAME})`);
  } else {
    console.log(`Reusing frontdesk agent ${agentId} (${existing?.name})`);
  }

  const assign = await assignNumberToAgent({
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    agentId,
  });

  const agent = await prisma.voiceAgent.findUnique({
    where: { id: agentId },
    select: { draftConfig: true },
  });
  const cfg = parseVoiceAgentConfig(agent?.draftConfig);
  if (!cfg.advanced?.livekitProfile || !cfg.messaging?.smsConfirmations) {
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        draftConfig: {
          ...cfg,
          advanced: {
            ...(cfg.advanced || {}),
            livekitProfile: "frontdesk",
          },
          messaging: {
            ...(cfg.messaging || {}),
            smsConfirmations: true,
          },
        },
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId,
        agentName: AGENT_NAME,
        phoneE164: phone.e164,
        livekitProfile: "frontdesk",
        assign,
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
