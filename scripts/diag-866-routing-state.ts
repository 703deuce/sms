/**
 * Quick diagnostic: 866 routing + recent calls/voicemail
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const PHONE_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const AMY_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_ID } });
  const amy = await prisma.voiceAgent.findUnique({ where: { id: AMY_ID } });

  const recentCalls = await prisma.voiceCall.findMany({
    where: {
      OR: [{ toE164: { contains: "8663464256" } }, { phoneNumberId: PHONE_ID }],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      createdAt: true,
      status: true,
      agentId: true,
      fromE164: true,
      toE164: true,
      durationSeconds: true,
      telnyxConversationId: true,
      telnyxCallControlId: true,
    },
  });

  const recentVm = await prisma.voicemailMessage.findMany({
    where: { toE164: { contains: "8663464256" } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      fromE164: true,
      toE164: true,
      durationSeconds: true,
      transcriptStatus: true,
      humanCallId: true,
    },
  });

  let telnyxPn: Record<string, unknown> | null = null;
  try {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": E164 } },
    );
    telnyxPn = listed.data?.[0] || null;
  } catch (e) {
    telnyxPn = { error: String(e) };
  }

  console.log(
    JSON.stringify(
      {
        phone: phone
          ? {
              id: phone.id,
              e164: phone.e164,
              voiceAgentId: phone.voiceAgentId,
              settingsJson: phone.settingsJson,
            }
          : null,
        amy: amy
          ? {
              id: amy.id,
              name: amy.name,
              phoneNumberId: amy.phoneNumberId,
              telnyxAssistantId: amy.telnyxAssistantId,
              status: amy.status,
            }
          : null,
        recentCalls,
        recentVm,
        telnyxNumber: telnyxPn
          ? {
              connection_id: telnyxPn.connection_id,
              connection_name: telnyxPn.connection_name,
              status: telnyxPn.status,
            }
          : null,
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
