/**
 * Create or update the demo outbound lead qualification agent (Blue Ridge Realty).
 * Does NOT modify inbound/frontdesk agents.
 *
 * Run: npx tsx scripts/setup-outbound-lead-agent.ts
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

dotenv.config();

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();

async function main() {
  const prisma = getPrisma();
  const qualification = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "scripts/fixtures/blue-ridge-realty-qualification.json"),
      "utf8",
    ),
  );

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: WORKSPACE_ID, e164: PHONE_E164 },
    select: { id: true, e164: true },
  });
  if (!phone) {
    throw new Error(`Phone ${PHONE_E164} not found in ${WORKSPACE_ID}`);
  }

  let agent = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      name: "Outbound Lead Qualification (Demo)",
    },
  });

  const baseConfig = agent ? parseVoiceAgentConfig(agent.draftConfig) : parseVoiceAgentConfig({});
  const draftConfig = {
    ...baseConfig,
    advanced: {
      ...(baseConfig.advanced || {}),
      livekitProfile: "outbound_lead_qualification",
      outboundQualification: qualification,
    },
    dynamicVariables: {
      ...(baseConfig.dynamicVariables || {}),
      business_name: qualification.businessName,
    },
  };

  if (agent) {
    agent = await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        draftConfig: draftConfig as object,
        outboundAiEnabled: true,
        status: "TESTING",
        phoneNumberId: phone.id,
        directions: ["outbound"],
      },
    });
    console.log("Updated agent:", agent.id);
  } else {
    agent = await prisma.voiceAgent.create({
      data: {
        workspaceId: WORKSPACE_ID,
        name: "Outbound Lead Qualification (Demo)",
        description: "Warm lead qualification — Blue Ridge Realty demo",
        agentType: "custom",
        status: "TESTING",
        outboundAiEnabled: true,
        phoneNumberId: phone.id,
        directions: ["outbound"],
        draftConfig: draftConfig as object,
      },
    });
    console.log("Created agent:", agent.id);
  }

  await prisma.voiceAgentPhoneNumber.upsert({
    where: {
      agentId_phoneNumberId: { agentId: agent.id, phoneNumberId: phone.id },
    },
    create: {
      workspaceId: WORKSPACE_ID,
      agentId: agent.id,
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

  console.log(
    JSON.stringify(
      {
        agentId: agent.id,
        callerId: phone.e164,
        profile: "outbound_lead_qualification",
        note: "Inbound on this number is unchanged until you reassign routing manually.",
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
