import { getPrisma } from "../src/lib/db";
import { getRegistrationByWorkspace } from "../src/lib/messaging/store";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import { classifyProductionNumber } from "../src/lib/messaging/compliance/phone-number-class";
import { isPhoneAuthorizedForOutboundSms } from "../src/lib/mctb/messaging/outbound-sms-route";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function telnyxPn(e164: string) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164 },
  });
  return res.data?.[0] || null;
}

async function main() {
  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WS },
    select: {
      id: true,
      e164: true,
      status: true,
      provider: true,
      type: true,
      settingsJson: true,
      a2pStatus: true,
      providerNumberId: true,
    },
    orderBy: { e164: "asc" },
  });
  const reg = await getRegistrationByWorkspace(WS);
  const prodRegs = await prisma.messagingProductRegistration.findMany({ where: { workspaceId: WS } });
  const smartRouting = await prisma.smartRoutingFlow.findMany({
    where: { workspaceId: WS },
    select: { id: true, name: true, assignedPhoneNumberId: true, status: true },
  });
  const agentJoins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: WS },
    include: { agent: { select: { id: true, name: true, status: true } } },
  });

  const rows = [];
  for (const p of phones) {
    const telnyx = p.status === "Active" ? await telnyxPn(p.e164) : null;
    const outbound = p.status === "Active" ? await isPhoneAuthorizedForOutboundSms(p.id) : null;
    const caps = readPhoneCapabilities(p);
    const telephony = (p.settingsJson as Record<string, unknown>)?.telephony as Record<string, unknown> | undefined;
    rows.push({
      id: p.id,
      e164: p.e164,
      status: p.status,
      class: classifyProductionNumber(p),
      routingMode: telephony?.routingMode,
      routingOwner: (p.settingsJson as Record<string, unknown>)?.routingOwner,
      aiAfterHours: caps.aiAfterHoursEnabled,
      mctbEnabled: caps.mctbEnabled,
      telnyx: telnyx
        ? {
            connection_id: telnyx.connection_id,
            connection_name: telnyx.connection_name,
            messaging_profile_id: telnyx.messaging_profile_id,
          }
        : null,
      outbound,
    });
  }

  console.log(JSON.stringify({ workspaceId: WS, reg, prodRegs, smartRouting, agentJoins, numbers: rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
