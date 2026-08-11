/**
 * Clone the outbound lead qualification demo agent for OpenAI Realtime A/B testing.
 * Does NOT modify the source (stack) agent — creates a separate voice agent record.
 *
 * Run:
 *   npx tsx scripts/setup-outbound-lead-agent-realtime-clone.ts
 *
 * Optional env:
 *   SOURCE_AGENT_ID=cmsnkf2iq233o6t4g396h1g5b   # defaults to demo agent name lookup
 *   WORKSPACE_ID=ws_1
 *   PHONE_E164=+18663464256                     # only used when ASSIGN_PHONE=1
 *   ASSIGN_PHONE=0                             # set 1 to move caller ID to the clone
 *   REALTIME_MODEL=gpt-realtime-2.1-mini       # stored on agent; override at runtime via VOICE_REALTIME_MODEL
 *
 * After setup:
 *   1. Point OUTBOUND_SMOKE_AGENT_ID at the printed clone agentId (or reassign the phone with ASSIGN_PHONE=1)
 *   2. Set OUTBOUND_AUTO_SMOKE_CALL=1 + OUTBOUND_TEST_PHONE for post-deploy smoke
 *   3. Switch model: VOICE_REALTIME_MODEL=gpt-realtime-2.1 (full) vs gpt-realtime-2.1-mini
 *   4. Roll back: point the number back to the original stack agent — source agent is untouched
 */
import dotenv from "dotenv";
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import {
  OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
  getOutboundQualificationFromConfig,
} from "../src/lib/voice/outbound/agent-config";

dotenv.config();

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const SOURCE_AGENT_ID = process.env.SOURCE_AGENT_ID?.trim();
const SOURCE_AGENT_NAME =
  process.env.SOURCE_AGENT_NAME?.trim() || "Outbound Lead Qualification (Demo)";
const CLONE_AGENT_NAME =
  process.env.CLONE_AGENT_NAME?.trim() || "Outbound Lead Qualification (Realtime Test)";
const REALTIME_MODEL =
  process.env.REALTIME_MODEL?.trim() || "gpt-realtime-2.1-mini";
const REALTIME_VOICE = process.env.REALTIME_VOICE?.trim() || "marin";
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const ASSIGN_PHONE = process.env.ASSIGN_PHONE === "1";

async function main() {
  const prisma = getPrisma();

  const source = SOURCE_AGENT_ID
    ? await prisma.voiceAgent.findFirst({
        where: { id: SOURCE_AGENT_ID, workspaceId: WORKSPACE_ID },
      })
    : await prisma.voiceAgent.findFirst({
        where: { workspaceId: WORKSPACE_ID, name: SOURCE_AGENT_NAME },
      });

  if (!source) {
    throw new Error(
      `Source agent not found (${SOURCE_AGENT_ID || SOURCE_AGENT_NAME}) in ${WORKSPACE_ID}`,
    );
  }

  const sourceConfig = parseVoiceAgentConfig(source.draftConfig);
  const qualification = getOutboundQualificationFromConfig(sourceConfig);
  if (!qualification) {
    throw new Error(
      "Source agent has no outboundQualification config — run setup-outbound-lead-agent.ts first",
    );
  }

  const draftConfig = {
    ...sourceConfig,
    advanced: {
      ...(sourceConfig.advanced || {}),
      livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
      outboundQualification: qualification,
      realtimeModel: REALTIME_MODEL,
      realtimeVoice: REALTIME_VOICE,
    },
    dynamicVariables: {
      ...(sourceConfig.dynamicVariables || {}),
      business_name: qualification.businessName,
    },
  };

  let phone: { id: string; e164: string } | null = null;
  if (ASSIGN_PHONE) {
    phone = await prisma.phoneNumber.findFirst({
      where: { workspaceId: WORKSPACE_ID, e164: PHONE_E164 },
      select: { id: true, e164: true },
    });
    if (!phone) {
      throw new Error(`Phone ${PHONE_E164} not found in ${WORKSPACE_ID}`);
    }
  }

  let clone = await prisma.voiceAgent.findFirst({
    where: { workspaceId: WORKSPACE_ID, name: CLONE_AGENT_NAME },
  });

  if (clone) {
    clone = await prisma.voiceAgent.update({
      where: { id: clone.id },
      data: {
        draftConfig: draftConfig as object,
        outboundAiEnabled: true,
        status: "TESTING",
        directions: ["outbound"],
        ...(phone ? { phoneNumberId: phone.id } : {}),
      },
    });
    console.log("Updated realtime clone:", clone.id);
  } else {
    clone = await prisma.voiceAgent.create({
      data: {
        workspaceId: WORKSPACE_ID,
        name: CLONE_AGENT_NAME,
        description:
          "OpenAI Realtime clone of outbound lead qualification — same workflow, speech-to-speech pipeline",
        agentType: source.agentType || "custom",
        status: "TESTING",
        outboundAiEnabled: true,
        directions: ["outbound"],
        ...(phone ? { phoneNumberId: phone.id } : {}),
        draftConfig: draftConfig as object,
      },
    });
    console.log("Created realtime clone:", clone.id);
  }

  if (phone) {
    await prisma.voiceAgentPhoneNumber.upsert({
      where: {
        agentId_phoneNumberId: { agentId: clone.id, phoneNumberId: phone.id },
      },
      create: {
        workspaceId: WORKSPACE_ID,
        agentId: clone.id,
        phoneNumberId: phone.id,
        inboundEnabled: false,
        outboundEnabled: true,
        isDefault: true,
      },
      update: {
        inboundEnabled: false,
        outboundEnabled: true,
        isDefault: true,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        sourceAgentId: source.id,
        sourceAgentName: source.name,
        cloneAgentId: clone.id,
        cloneAgentName: clone.name,
        profile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
        realtimeModel: REALTIME_MODEL,
        realtimeVoice: REALTIME_VOICE,
        phoneAssigned: phone?.e164 || null,
        smoke: {
          OUTBOUND_SMOKE_AGENT_ID: clone.id,
          OUTBOUND_AUTO_SMOKE_CALL: "1",
          OUTBOUND_TEST_PHONE: process.env.OUTBOUND_TEST_PHONE || "+15714776175",
        },
        switchToFullModel: {
          VOICE_REALTIME_MODEL: "gpt-realtime-2.1",
          VOICE_REALTIME_REASONING_EFFORT: "low",
        },
        rollback: "Reassign phone to source agent or clear OUTBOUND_SMOKE_AGENT_ID",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
