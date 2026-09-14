#!/usr/bin/env npx tsx
/**
 * Detach voice AI agent from MCTB DID and activate John (missed call text back).
 *
 *   WORKSPACE_ID=ws_1 PHONE_NUMBER_ID=... AMY_AGENT_ID=... \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-live-switch-to-john.ts
 */
import { getPrisma } from "@/lib/db";
import {
  activateJohnOnPhoneNumber,
  detachVoiceAgentFromNumber,
} from "@/lib/agents/missed-call-text-back/phone-switch";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/onboarding/phone-numbers";
import { formatAttNoAnswerForwardDialCode } from "@/lib/mctb/onboarding/carrier-capabilities";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID?.trim();
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || process.env.AMY_AGENT_ID?.trim();
const RING_SECONDS = Number(process.env.FORWARD_RING_SECONDS || "10");

async function main() {
  const prisma = getPrisma();
  const forwardTo = await getProductionMctbForwardTargetE164(WORKSPACE_ID);

  let phoneNumberId = PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    const mctbPhone = forwardTo
      ? await prisma.phoneNumber.findFirst({
          where: { workspaceId: WORKSPACE_ID, e164: forwardTo },
          select: { id: true, e164: true },
        })
      : null;
    phoneNumberId =
      mctbPhone?.id ||
      (
        await prisma.phoneNumber.findFirst({
          where: { workspaceId: WORKSPACE_ID, e164: HP_CERTIFIED_SMS_E164 },
          select: { id: true },
        })
      )?.id ||
      (
        await prisma.phoneNumber.findFirst({
          where: { workspaceId: WORKSPACE_ID },
          orderBy: { updatedAt: "desc" },
          select: { id: true, e164: true },
        })
      )?.id;
  }

  if (!phoneNumberId) throw new Error("No PHONE_NUMBER_ID and no workspace phone found");

  const pn = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: { id: true, e164: true, workspaceId: true, voiceAgentId: true },
  });
  if (!pn || pn.workspaceId !== WORKSPACE_ID) throw new Error("Phone not found for workspace");

  const agentOnNumber = await prisma.voiceAgent.findFirst({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: pn.id },
    select: { id: true, name: true },
  });
  const agentId = AGENT_ID || agentOnNumber?.id || pn.voiceAgentId;

  if (agentId) {
    console.log("Detaching voice agent", agentId, "from", pn.e164);
    await detachVoiceAgentFromNumber({
      workspaceId: WORKSPACE_ID,
      agentId,
      phoneNumberId: pn.id,
    });
  } else {
    console.log("No voice agent on number — skipping detach");
  }

  const smsId =
    (
      await prisma.phoneNumber.findFirst({
        where: { workspaceId: WORKSPACE_ID, e164: HP_CERTIFIED_SMS_E164 },
        select: { id: true },
      })
    )?.id || pn.id;

  const activated = await activateJohnOnPhoneNumber({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: pn.id,
    smsPhoneNumberId: smsId,
    delaySeconds: 0,
    activate: true,
  });

  const attDial = forwardTo
    ? formatAttNoAnswerForwardDialCode({
        forwardToE164: forwardTo,
        delaySeconds: RING_SECONDS,
      })
    : null;

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        mctbVoiceIngressE164: pn.e164,
        smsFromE164: HP_CERTIFIED_SMS_E164,
        forwardCallsToThisNumber: forwardTo,
        johnActivated: activated.ok,
        attIphoneNoAnswer10s: attDial,
        liveSteps: [
          attDial
            ? `On business iPhone (AT&T): open Phone → dial ${attDial} → Call (sets no-answer forward to ${forwardTo} after ${RING_SECONDS}s).`
            : "Set no-answer forward on your business line to your MCTB ingress number.",
          `From another phone, call your business line — do not answer.`,
          `On ${forwardTo}: hear Press-1 → press 1.`,
          `Hang up; you should get the missed-call text on the caller's phone.`,
          `Reply to start Lead Recovery live test #1.`,
        ],
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
