#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import { formatAttNoAnswerForwardDialCode } from "@/lib/mctb/onboarding/carrier-capabilities";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const SECONDS = Number(process.env.FORWARD_RING_SECONDS || "10");

async function main() {
  const prisma = getPrisma();
  const mctb = await loadMissedCallTextConfig(WORKSPACE_ID);
  const forwardTo = await getProductionMctbForwardTargetE164(WORKSPACE_ID);
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      e164: true,
      status: true,
      settingsJson: true,
    },
    orderBy: { purchasedAt: "desc" },
    take: 15,
  });
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, phoneNumberId: true },
  });
  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        mctbConfig: {
          enabled: mctb.enabled,
          phoneNumberId: mctb.phoneNumberId,
          smsPhoneNumberId: mctb.smsPhoneNumberId,
          delay_seconds: mctb.delay_seconds,
        },
        productionForwardTargetE164: forwardTo,
        hp571: HP_CERTIFIED_SMS_E164,
        attDial10s: forwardTo
          ? formatAttNoAnswerForwardDialCode({ forwardToE164: forwardTo, delaySeconds: SECONDS })
          : null,
        attDial571_10s: formatAttNoAnswerForwardDialCode({
          forwardToE164: HP_CERTIFIED_SMS_E164,
          delaySeconds: SECONDS,
        }),
        voiceAgents: agents,
        phoneNumbers: phones.map((p) => ({
          id: p.id,
          e164: p.e164,
          status: p.status,
        })),
      },
      null,
      2,
    ),
  );
}

main();
