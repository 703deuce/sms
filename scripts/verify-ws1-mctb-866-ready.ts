import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";
import {
  peekMctbInboundRoutingProfileByE164,
  warmMctbInboundRoutingProfileForWorkspace,
} from "../src/lib/mctb/texml-ingress/routing-profile";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { getPrisma } from "../src/lib/db";
import { getRegistrationByWorkspace } from "../src/lib/messaging/store";
import { isPhoneAuthorizedForOutboundSms } from "../src/lib/mctb/messaging/outbound-sms-route";

const WS = "ws_1";
const E164_866 = "+18663464256";
const E164_571 = "+15714073615";

async function telnyxPn(e164: string) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164 },
  });
  return res.data?.[0] || null;
}

async function main() {
  await warmMctbInboundRoutingProfileForWorkspace(WS);
  const config = await loadMissedCallTextConfig(WS);
  const consentMode = await loadMctbConsentMode(WS);
  const reg = await getRegistrationByWorkspace(WS);
  const prisma = getPrisma();

  const voicePhone = config.phoneNumberId
    ? await prisma.phoneNumber.findUnique({ where: { id: config.phoneNumberId } })
    : null;
  const smsPhone = config.smsPhoneNumberId
    ? await prisma.phoneNumber.findUnique({ where: { id: config.smsPhoneNumberId } })
    : null;

  const smartRouting = await prisma.smartRoutingFlow.findFirst({
    where: { workspaceId: WS, assignedPhoneNumberId: { not: null }, status: { in: ["active", "paused"] } },
    select: { id: true, name: true, status: true, assignedPhoneNumberId: true },
  });

  const agentJoins866 = await prisma.voiceAgentPhoneNumber.count({
    where: { phoneNumberId: voicePhone?.id || "" },
  });

  const pn866 = await telnyxPn(E164_866);
  const pn571 = await telnyxPn(E164_571);
  const profile866 = peekMctbInboundRoutingProfileByE164(E164_866);

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;
  const entryRes = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164_866,
      CallSid: `ready-check-${Date.now()}`,
    }),
  });
  const entryXml = await entryRes.text();

  const smsAuth = smsPhone ? await isPhoneAuthorizedForOutboundSms(smsPhone.id) : null;

  const card = {
    readyForLiveConditionalForwardTest:
      Boolean(config.enabled) &&
      consentMode === "press_1" &&
      voicePhone?.e164 === E164_866 &&
      pn866?.connection_id === "3037587396909598261" &&
      agentJoins866 === 0 &&
      entryRes.ok &&
      entryXml.includes("Gather") &&
      Boolean(smsAuth?.allowed),
    testDid: E164_866,
    voiceTrigger: voicePhone
      ? { id: voicePhone.id, e164: voicePhone.e164, routingMode: (voicePhone.settingsJson as any)?.telephony?.routingMode }
      : null,
    smsSender: smsPhone
      ? { id: smsPhone.id, e164: smsPhone.e164, outboundAuthorized: smsAuth }
      : null,
    messagingCampaign: {
      profileId: reg?.messagingProfileId,
      campaignId: reg?.campaignId,
      campaignStatus: reg?.campaignStatus,
      attachedNumber: reg?.phoneE164,
      note: "10DLC campaign remains on 571 — toll-free 866 cannot join 10DLC; SMS sends from 571 after press-1 consent on 866.",
    },
    voiceIngress: {
      telnyxConnectionId: pn866?.connection_id,
      telnyxConnectionName: pn866?.connection_name,
      expectedAppId: "3037587396909598261",
      onMctbTexmlApp: pn866?.connection_id === "3037587396909598261",
    },
    smartRoutingOn571: smartRouting?.assignedPhoneNumberId === smsPhone?.id
      ? { flowId: smartRouting.id, name: smartRouting.name, status: smartRouting.status }
      : null,
    aiAgentJoinsOn866: agentJoins866,
    consentMode,
    warmedProfile866: profile866
      ? {
          consentMode: profile866.consentMode,
          automationActive: profile866.automationActive,
          press1PlayUrl: profile866.press1PlayUrl,
        }
      : null,
    entryProbe866: {
      status: entryRes.status,
      hasGather: entryXml.includes("Gather"),
      preview: entryXml.slice(0, 220),
    },
    compare571: {
      telnyxConnectionId: pn571?.connection_id,
      telnyxConnectionName: pn571?.connection_name,
      smartRoutingAssigned: smartRouting?.assignedPhoneNumberId === pn571?.id,
      conflicts: [
        smartRouting?.assignedPhoneNumberId === pn571?.id
          ? "Published Smart Routing flow still assigned to 571"
          : null,
        pn571?.connection_id === "3037587396909598261"
          ? "571 also on MCTB TeXML app (OK if not forwarded to)"
          : null,
      ].filter(Boolean),
    },
    liveTestInstructions: {
      forwardCarrierConditionalTo: E164_866,
      expectedFlow:
        "CFNA → 866 → MCTB TeXML ingress → consent audio → press 1 → SMS from 571",
      watchLogsFor: [
        "mctb-entry texml_response",
        "MCTB_DTMF_RECEIVED",
        "MCTB_CONSENT_RECORDED",
        "MCTB_SMS_QUEUED",
        "MCTB_SMS_ACCEPTED",
      ],
    },
  };

  console.log(JSON.stringify(card, null, 2));
  if (!card.readyForLiveConditionalForwardTest) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
