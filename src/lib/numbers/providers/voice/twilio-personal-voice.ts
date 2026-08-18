/**
 * Twilio Programmable Voice TwiML for Personal numbers (provider=twilio).
 * Carrier stays on Twilio: forwarding, voicemail, transcription callbacks.
 */

import { getPrisma } from "@/lib/db";
import { resolveNumberInboundRoute } from "@/lib/numbers/inbound-number-routing";
import {
  PERSONAL_UNAVAILABLE_MESSAGE,
  readPersonalCallSettings,
  type ForwardUnansweredAction,
} from "@/lib/numbers/personal-call-settings";
import { TRANSOVO_SCREEN_PROMPT } from "@/lib/numbers/forward-screening";
import {
  hasTerminalForwardOutcome,
  tagForwardOutcome,
} from "@/lib/numbers/forward-call-outcomes";
import { isScreeningAccepted } from "@/lib/numbers/forward-screening";
import { tagTwilioForwardOverflow } from "@/lib/numbers/personal-forward-twilio-fallback";
import { assertPhoneNumberProvider } from "@/lib/numbers/providers/provider-guard";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { handleInboundHumanCall } from "@/lib/phone/human-call-service";
import {
  twilioVoicemailTranscriptionCallbackUrl,
} from "@/lib/phone/twilio-voicemail-pipeline";
import { ensureNumberVoicemailBox } from "@/lib/phone/voicemail-service";
import { resolveVoicemailGreetingPlayback } from "@/lib/phone/voicemail-greeting-playback";

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

function parseHuntIndex(notes: string | null | undefined): number {
  const match = notes?.match(/\[hunt_index:(\d+)\]/);
  return match ? Number(match[1]) : 0;
}

function parseHuntTargets(notes: string | null | undefined): string[] {
  const match = notes?.match(/\[hunt_targets:([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function isCallerBlocked(
  workspaceId: string,
  phoneNumberId: string,
  from: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const perNumberKey = `${workspaceId}:${phoneNumberId}:p:${from}`;
  return Boolean(
    await prisma.suppression.findFirst({
      where: {
        workspaceId,
        OR: [
          { suppressionKey: perNumberKey },
          { suppressionKey: `p:${from}` },
          { phone: from },
        ],
      },
    }),
  );
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

  try {
    assertPhoneNumberProvider(pn, "twilio");
  } catch {
    return twiml("<Say>This number is not configured for Twilio voice.</Say><Hangup/>");
  }

  const { tryStartTwilioSmartRoutingInbound } = await import(
    "@/lib/smart-routing/twilio-webhook-handler"
  );
  const smartRouting = await tryStartTwilioSmartRoutingInbound({
    workspaceId: pn.workspaceId,
    phoneNumberId: pn.id,
    fromE164: from,
    toE164: to,
    callSid: params.callSid,
  });
  if (smartRouting.started && smartRouting.twiml) {
    return smartRouting.twiml;
  }

  if (await isCallerBlocked(pn.workspaceId, pn.id, from)) {
    const settings =
      pn.settingsJson && typeof pn.settingsJson === "object"
        ? (pn.settingsJson as Record<string, unknown>)
        : {};
    if (settings.blockedCallerAction === "unavailable_message") {
      return twiml(`<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`);
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

  const route = resolveNumberInboundRoute(pn);
  const base = getAppBaseUrl();
  const statusUrl = `${base}/api/webhooks/twilio/voice?humanCallId=${encodeURIComponent(human.callId)}`;
  const recordingUrl = `${base}/api/webhooks/twilio/voice/recording?humanCallId=${encodeURIComponent(human.callId)}`;

  const routeTag = `[provider:twilio] [forward_unanswered:${route.kind === "forward" ? route.unansweredAction : "voicemail"}]`;

  await prisma.humanCall.update({
    where: { id: human.callId },
    data: {
      notes: `${human.call?.notes || ""}\n[twilio_call_sid:${params.callSid}]\n${routeTag}`.trim(),
    },
  });

  if (route.kind === "vault_silent") {
    return twiml("<Hangup/>");
  }
  if (route.kind === "vault_message") {
    return twiml(`<Say>${xmlEscape(route.message)}</Say><Hangup/>`);
  }
  if (route.kind === "announcement") {
    const callSettings = readPersonalCallSettings(pn);
    if (callSettings.announcementUrl?.trim()) {
      return twiml(`<Play>${xmlEscape(callSettings.announcementUrl.trim())}</Play><Hangup/>`);
    }
    return twiml(`<Say>${xmlEscape(route.message)}</Say><Hangup/>`);
  }
  if (route.kind === "voicemail" || route.kind === "vault_voicemail") {
    return buildVoicemailTwiml(pn.workspaceId, pn.id, human.callId, recordingUrl);
  }
  if (route.kind === "forward") {
    const huntNote = `[hunt_targets:${route.destinations.join(",")}] [hunt_index:0]`;
    await prisma.humanCall.update({
      where: { id: human.callId },
      data: {
        notes: `${human.call?.notes || ""}\n${huntNote}${route.callScreening ? "\n[personal_forward:screening]" : ""}`.trim(),
      },
    });
    const callSettings = readPersonalCallSettings(pn);
    return await buildForwardTwiml({
      route,
      humanCallId: human.callId,
      transovoNumber: to,
      callerNumber: from,
      statusUrl,
      recordingUrl,
      huntIndex: 0,
      pn,
      screeningSeconds: callSettings.forwardScreeningSeconds,
    });
  }

  if (route.kind === "unavailable") {
    return twiml(`<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`);
  }

  return twiml(`<Say>${xmlEscape(PERSONAL_UNAVAILABLE_MESSAGE)}</Say><Hangup/>`);
}

async function buildForwardTwiml(input: {
  route: {
    destinations: string[];
    mode: "single" | "sequential" | "simultaneous";
    ringSeconds: number;
    unansweredAction: ForwardUnansweredAction;
    callScreening: boolean;
    callerIdDisplay: "original" | "transovo_number";
  };
  humanCallId: string;
  transovoNumber: string;
  callerNumber: string;
  statusUrl: string;
  recordingUrl: string;
  huntIndex: number;
  screeningSeconds: number;
  pn: { id: string; workspaceId: string };
}): Promise<string> {
  const callerId =
    input.route.callerIdDisplay === "transovo_number"
      ? input.transovoNumber
      : input.callerNumber;
  const targets = input.route.destinations;
  if (!targets.length) {
    return buildVoicemailTwiml(
      input.pn.workspaceId,
      input.pn.id,
      input.humanCallId,
      input.recordingUrl,
    );
  }

  const sequential = input.route.mode === "sequential";
  const simultaneous = input.route.mode === "simultaneous";
  const dialTargets =
    simultaneous
      ? targets
      : sequential
        ? [targets[input.huntIndex] ?? targets[0]]
        : [targets[0]];

  const base = getAppBaseUrl();
  const screenUrl = `${base}/api/webhooks/twilio/voice/screen?humanCallId=${encodeURIComponent(input.humanCallId)}&leg=destination&screeningSeconds=${input.screeningSeconds}`;

  const numbersXml = dialTargets
    .map((dest) => {
      const numberAttrs = input.route.callScreening
        ? ` url="${xmlEscape(screenUrl)}" urlMethod="POST"`
        : "";
      return `<Number${numberAttrs}>${xmlEscape(dest)}</Number>`;
    })
    .join("");

  return twiml(
    `<Dial callerId="${xmlEscape(callerId)}" timeout="${input.route.ringSeconds}" action="${xmlEscape(input.statusUrl)}">${numbersXml}</Dial>`,
  );
}

async function buildVoicemailTwiml(
  workspaceId: string,
  phoneNumberId: string,
  humanCallId: string,
  recordingCallbackUrl: string,
): Promise<string> {
  const prisma = getPrisma();
  let box = await prisma.voicemailBox.findFirst({
    where: { workspaceId, phoneNumberId, active: true },
  });
  if (!box) {
    box = await ensureNumberVoicemailBox(workspaceId, phoneNumberId);
  }
  const playback = await resolveVoicemailGreetingPlayback(workspaceId, box);
  const greetingText =
    playback.sayText || box?.greetingText?.trim() || "Please leave a message after the tone.";
  const greetingUrl = playback.playUrl;
  const transcribeCallback = twilioVoicemailTranscriptionCallbackUrl(humanCallId);

  let preamble = "";
  if (greetingUrl) {
    preamble = `<Play>${xmlEscape(greetingUrl)}</Play>`;
  } else {
    preamble = `<Say>${xmlEscape(greetingText)}</Say>`;
  }

  return twiml(
    `${preamble}<Record maxLength="180" playBeep="true" transcribe="true" transcribeCallback="${xmlEscape(transcribeCallback)}" recordingStatusCallback="${xmlEscape(recordingCallbackUrl)}" recordingStatusCallbackMethod="POST"/>`,
  );
}

export async function buildTwilioDialStatusTwiml(params: {
  dialCallStatus: string;
  humanCallId: string;
}): Promise<string> {
  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: params.humanCallId } });
  if (!human) return twiml("<Hangup/>");
  if (hasTerminalForwardOutcome(human.notes)) return twiml("");

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: human.workspaceId, e164: human.to },
  });
  if (!pn) return twiml("<Hangup/>");

  const base = getAppBaseUrl();
  const statusUrl = `${base}/api/webhooks/twilio/voice?humanCallId=${encodeURIComponent(human.id)}`;
  const recordingUrl = `${base}/api/webhooks/twilio/voice/recording?humanCallId=${encodeURIComponent(human.id)}`;

  const route = resolveNumberInboundRoute(pn);
  const callSettings = readPersonalCallSettings(pn);
  const screeningRequired =
    route.kind === "forward" && route.callScreening;
  const accepted = isScreeningAccepted(human.notes);

  const dialCompleted =
    params.dialCallStatus === "completed" || params.dialCallStatus === "answered";

  if (dialCompleted) {
    if (screeningRequired && !accepted) {
      await tagForwardOutcome(human.id, "SCREENING_TIMEOUT");
      const fallback = await tagTwilioForwardOverflow(
        human.id,
        "unanswered",
        route.kind === "forward" ? route.unansweredAction : "transovo_voicemail",
      );
      if (fallback === "transovo_voicemail") {
        return buildVoicemailTwiml(pn.workspaceId, pn.id, human.id, recordingUrl);
      }
      return twiml("<Hangup/>");
    }
    await tagForwardOutcome(human.id, "FORWARDED_ANSWERED");
    await prisma.humanCall.update({
      where: { id: human.id },
      data: { status: "in_progress", answeredAt: new Date() },
    });
    return twiml("");
  }

  const huntTargets = parseHuntTargets(human.notes);
  const huntIndex = parseHuntIndex(human.notes);

  const overflowReason =
    params.dialCallStatus === "busy"
      ? "busy"
      : params.dialCallStatus === "failed" || params.dialCallStatus === "canceled"
        ? "failed"
        : "unanswered";

  if (
    route.kind === "forward" &&
    route.mode === "sequential" &&
    huntTargets.length > 1 &&
    huntIndex + 1 < huntTargets.length &&
    overflowReason === "unanswered"
  ) {
    const nextIndex = huntIndex + 1;
    await prisma.humanCall.update({
      where: { id: human.id },
      data: {
        notes: `${human.notes || ""}\n[hunt_index:${nextIndex}]`.trim(),
      },
    });
    return await buildForwardTwiml({
      route,
      humanCallId: human.id,
      transovoNumber: human.to,
      callerNumber: human.from,
      statusUrl,
      recordingUrl,
      huntIndex: nextIndex,
      screeningSeconds: callSettings.forwardScreeningSeconds,
      pn,
    });
  }

  if (overflowReason === "busy" && callSettings.forwardBusyAction === "another_number") {
    const alt = callSettings.forwardBusyNumber?.trim();
    if (alt) {
      return twiml(
        `<Dial callerId="${xmlEscape(human.to)}" timeout="${route.kind === "forward" ? route.ringSeconds : 25}"><Number>${xmlEscape(alt)}</Number></Dial>`,
      );
    }
  }
  if (overflowReason === "failed" && callSettings.forwardFailedAction === "another_number") {
    const alt = callSettings.forwardFailedNumber?.trim();
    if (alt) {
      return twiml(
        `<Dial callerId="${xmlEscape(human.to)}" timeout="${route.kind === "forward" ? route.ringSeconds : 25}"><Number>${xmlEscape(alt)}</Number></Dial>`,
      );
    }
  }
  if (
    (overflowReason === "busy" || overflowReason === "failed") &&
    (callSettings.forwardBusyAction === "announcement" ||
      callSettings.forwardFailedAction === "announcement")
  ) {
    const useAnnouncement =
      overflowReason === "busy"
        ? callSettings.forwardBusyAction === "announcement"
        : callSettings.forwardFailedAction === "announcement";
    if (useAnnouncement) {
      if (callSettings.announcementUrl?.trim()) {
        return twiml(
          `<Play>${xmlEscape(callSettings.announcementUrl.trim())}</Play><Hangup/>`,
        );
      }
      return twiml(`<Say>${xmlEscape(callSettings.announcementText)}</Say><Hangup/>`);
    }
  }

  const unansweredAction =
    route.kind === "forward" ? route.unansweredAction : "transovo_voicemail";
  const fallback = await tagTwilioForwardOverflow(human.id, overflowReason, unansweredAction);

  if (fallback === "hang_up") {
    await prisma.humanCall.update({
      where: { id: human.id },
      data: { status: "no-answer" },
    });
    return twiml("<Hangup/>");
  }

  if (fallback === "transovo_voicemail") {
    return buildVoicemailTwiml(pn.workspaceId, pn.id, human.id, recordingUrl);
  }

  await prisma.humanCall.update({
    where: { id: human.id },
    data: { status: "no-answer" },
  });
  return twiml("");
}

/** Destination-leg Press-1 screening (called party only — caller never hears this). */
export async function buildTwilioDestinationScreenTwiml(params: {
  humanCallId: string;
  digits?: string;
  screeningSeconds: number;
}): Promise<string> {
  const prisma = getPrisma();
  const human = await prisma.humanCall.findUnique({ where: { id: params.humanCallId } });
  if (!human || hasTerminalForwardOutcome(human.notes)) {
    return twiml("<Hangup/>");
  }

  const base = getAppBaseUrl();
  const actionUrl = `${base}/api/webhooks/twilio/voice/screen?humanCallId=${encodeURIComponent(params.humanCallId)}&leg=destination&screeningSeconds=${params.screeningSeconds}`;

  if (!params.digits) {
    return twiml(
      `<Gather numDigits="1" timeout="${params.screeningSeconds}" action="${xmlEscape(actionUrl)}" method="POST"><Say>${xmlEscape(TRANSOVO_SCREEN_PROMPT)}</Say></Gather><Hangup/>`,
    );
  }

  if (params.digits === "1") {
    await prisma.humanCall.update({
      where: { id: human.id },
      data: {
        notes: `${human.notes || ""}\nscreening:accepted`.trim(),
      },
    });
    return twiml("");
  }

  await tagForwardOutcome(params.humanCallId, "SCREENING_REJECTED");
  return twiml("<Hangup/>");
}

export async function buildTwilioScreenTwiml(params: {
  humanCallId: string;
  digits: string;
  screeningSeconds?: number;
}): Promise<string> {
  return buildTwilioDestinationScreenTwiml({
    humanCallId: params.humanCallId,
    digits: params.digits,
    screeningSeconds: params.screeningSeconds ?? 8,
  });
}
