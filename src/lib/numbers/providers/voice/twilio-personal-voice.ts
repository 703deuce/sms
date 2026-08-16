/**
 * Twilio Programmable Voice TwiML for Personal numbers (provider=twilio).
 */

import { getPrisma } from "@/lib/db";
import { resolveNumberInboundRoute } from "@/lib/numbers/inbound-number-routing";
import {
  PERSONAL_UNAVAILABLE_MESSAGE,
  readPersonalCallSettings,
} from "@/lib/numbers/personal-call-settings";
import { resolvePhoneNumberProvider } from "@/lib/numbers/providers/normalize";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { handleInboundHumanCall } from "@/lib/phone/human-call-service";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export async function buildTwilioInboundTwiml(params: {
  callSid: string;
  from: string;
  to: string;
}): Promise<string> {
  const prisma = getPrisma();
  const to = normalizeE164(params.to);
  const from = normalizeE164(params.from);

  const pn = await prisma.phoneNumber.findFirst({ where: { e164: to, releasedAt: null } });
  if (!pn) {
    return twiml("<Reject reason=\"rejected\"/>");
  }

  if (resolvePhoneNumberProvider(pn) !== "twilio") {
    return twiml("<Say>This number is not configured for Twilio voice.</Say><Hangup/>");
  }

  const blocked = await prisma.suppression.findFirst({
    where: {
      workspaceId: pn.workspaceId,
      OR: [
        { phone: from },
        { suppressionKey: `p:${from}` },
        { suppressionKey: `${pn.workspaceId}:p:${from}` },
      ],
    },
  });
  if (blocked) {
    const settings =
      pn.settingsJson && typeof pn.settingsJson === "object"
        ? (pn.settingsJson as Record<string, unknown>)
        : {};
    if (settings.blockedCallerAction === "unavailable_message") {
      return twiml(
        `<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`,
      );
    }
    return twiml("<Reject reason=\"rejected\"/>");
  }

  const human = await handleInboundHumanCall({
    workspaceId: pn.workspaceId,
    fromE164: from,
    toE164: to,
    telnyxCallControlId: params.callSid,
    routingNote: "twilio_inbound",
  });

  await prisma.humanCall.update({
    where: { id: human.callId },
    data: {
      notes: `${human.call?.notes || ""}\n[twilio_call_sid:${params.callSid}] [provider:twilio]`.trim(),
    },
  });

  const route = resolveNumberInboundRoute(pn);
  const base = getAppBaseUrl();
  const statusUrl = `${base}/api/webhooks/twilio/voice?humanCallId=${encodeURIComponent(human.callId)}`;
  const recordingUrl = `${base}/api/webhooks/twilio/voice/recording?humanCallId=${encodeURIComponent(human.callId)}`;

  if (route.kind === "vault_silent") {
    return twiml("<Hangup/>");
  }
  if (route.kind === "vault_message") {
    return twiml(`<Say>${xmlEscape(route.message)}</Say><Hangup/>`);
  }
  if (route.kind === "announcement") {
    return twiml(`<Say>${xmlEscape(route.message)}</Say><Hangup/>`);
  }
  if (route.kind === "voicemail" || route.kind === "vault_voicemail") {
    return buildVoicemailTwiml(pn.workspaceId, human.callId, recordingUrl);
  }
  if (route.kind === "forward") {
    const callSettings = readPersonalCallSettings(pn);
    const callerId =
      route.callerIdDisplay === "transovo_number" ? to : from;
    const dest = route.destinations[0];
    if (!dest) {
      return buildVoicemailTwiml(pn.workspaceId, human.callId, recordingUrl);
    }
    const timeout = route.ringSeconds;
    return twiml(
      `<Dial callerId="${xmlEscape(callerId)}" timeout="${timeout}" action="${xmlEscape(statusUrl)}"><Number>${xmlEscape(dest)}</Number></Dial>`,
    );
  }

  if (route.kind === "unavailable") {
    return twiml(`<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`);
  }

  return twiml(`<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`);
}

async function buildVoicemailTwiml(
  workspaceId: string,
  humanCallId: string,
  recordingCallbackUrl: string,
): Promise<string> {
  const prisma = getPrisma();
  const box = await prisma.voicemailBox.findFirst({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const greetingText =
    box?.greetingText?.trim() || "Please leave a message after the tone.";
  const greetingUrl = box?.greetingUrl?.trim();

  let preamble = "";
  if (greetingUrl) {
    preamble = `<Play>${xmlEscape(greetingUrl)}</Play>`;
  } else {
    preamble = `<Say>${xmlEscape(greetingText)}</Say>`;
  }

  return twiml(
    `${preamble}<Record maxLength="180" playBeep="true" recordingStatusCallback="${xmlEscape(recordingCallbackUrl)}" recordingStatusCallbackMethod="POST"/>`,
  );
}

export async function buildTwilioDialStatusTwiml(params: {
  dialCallStatus: string;
  humanCallId: string;
}): Promise<string> {
  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: params.humanCallId } });
  if (!human) return twiml("<Hangup/>");

  const answered =
    params.dialCallStatus === "completed" || params.dialCallStatus === "answered";
  if (answered) {
    await prisma.humanCall.update({
      where: { id: human.id },
      data: { status: "completed", answeredAt: new Date() },
    });
    return twiml("");
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: human.workspaceId, e164: human.to },
  });
  const callSettings = readPersonalCallSettings({
    settingsJson: pn?.settingsJson,
    voiceForwardTo: pn?.voiceForwardTo,
  });

  const base = getAppBaseUrl();
  const recordingUrl = `${base}/api/webhooks/twilio/voice/recording?humanCallId=${encodeURIComponent(human.id)}`;

  if (callSettings.forwardUnansweredAction === "end") {
    await prisma.humanCall.update({
      where: { id: human.id },
      data: { status: "no-answer", disposition: "twilio_no_answer" },
    });
    return twiml("<Hangup/>");
  }

  return buildVoicemailTwiml(human.workspaceId, human.id, recordingUrl);
}
