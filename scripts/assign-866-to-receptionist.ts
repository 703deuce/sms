/**
 * Reassign +18663464256 to Sarah receptionist without LiveKit SIP reprovision.
 * Use when redeploy boot steals the DID back to realty.
 *
 * Usage: npx tsx scripts/assign-866-to-receptionist.ts
 */
import { getPrisma } from "../src/lib/db";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { livekitProfileFromConfig } from "../src/lib/voice/frontdesk/agent-config";
import {
  buildExplicitDispatchMetadata,
  explicitDispatchPatchForPhoneSettings,
} from "../src/lib/telephony/provisioning/dispatch-metadata";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = "cmsqtfphh336n4a4q5v4u1a2t";
const PHONE_ID = "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = "+18663464256";

async function main() {
  const prisma = getPrisma();

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      status: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (!agent) throw new Error("Sarah receptionist agent not found");

  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneNumberId: PHONE_ID,
    exclusive: true,
  });

  await prisma.voiceAgent.update({
    where: { id: AGENT_ID },
    data: { phoneNumberId: PHONE_ID, status: "ACTIVE" },
  });

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const dispatch = buildExplicitDispatchMetadata({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    publishedVersionId: agent.publishedVersionId,
    livekitProfile: livekitProfileFromConfig(config.advanced as Record<string, unknown>),
    toE164: PHONE_E164,
    dispatchSource: "phone_provision",
  });

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WORKSPACE_ID },
    select: { settingsJson: true },
  });
  const settings =
    phone?.settingsJson && typeof phone.settingsJson === "object"
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};

  await prisma.phoneNumber.update({
    where: { id: PHONE_ID },
    data: {
      settingsJson: {
        ...settings,
        telephony: {
          ...telephony,
          ...explicitDispatchPatchForPhoneSettings(dispatch),
        },
      },
    },
  });

  const joins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: PHONE_ID, inboundEnabled: true },
    select: { agentId: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        phoneE164: PHONE_E164,
        agentId: AGENT_ID,
        agentName: agent.name,
        publishedVersionId: agent.publishedVersionId,
        explicitDispatch: dispatch,
        inboundJoins: joins.map((j) => j.agentId),
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
