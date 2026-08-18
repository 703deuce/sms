import "server-only";

import { decryptSecret } from "@/lib/messaging/crypto";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import {
  getLiveParentClient,
  getSubaccountTwilioClient,
} from "@/lib/messaging/twilio-client";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { updateSessionState } from "./session-store";
import type { SessionState } from "./types";
import { escapeXml } from "./prompt-playback";

function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function conferenceName(sessionId: string): string {
  return `sr-${sessionId}`;
}

function whisperAgentUrl(sessionId: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/api/webhooks/twilio/voice/smart-routing?sessionId=${encodeURIComponent(sessionId)}&event=whisper_agent`;
}

function whisperAcceptUrl(sessionId: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/api/webhooks/twilio/voice/smart-routing?sessionId=${encodeURIComponent(sessionId)}&event=whisper_accept`;
}

export async function getTwilioClientForWorkspace(workspaceId: string) {
  const reg = await getRegistrationByWorkspace(workspaceId);
  if (reg?.subaccountSid && reg.subaccountAuthTokenEnc) {
    const authToken = decryptSecret(reg.subaccountAuthTokenEnc);
    return getSubaccountTwilioClient(reg.subaccountSid, authToken);
  }
  return getLiveParentClient();
}

export async function startTwilioWhisperTransfer(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  callerCallSid: string;
  agentPhone: string;
  fromNumber: string;
  whisperText: string;
  acceptDigit?: string;
}): Promise<{ twiml: string }> {
  const conf = conferenceName(input.sessionId);
  const acceptDigit = input.acceptDigit ?? "1";

  await updateSessionState(input.sessionId, {
    currentNodeId: input.nodeId,
    stateJson: {
      awaitingEvent: "whisper",
      whisperText: input.whisperText,
      acceptDigit,
      whisperConference: conf,
      whisperAgentPhone: input.agentPhone,
    } as SessionState,
  });

  const client = await getTwilioClientForWorkspace(input.workspaceId);
  await client.calls.create({
    to: normalizeE164(input.agentPhone),
    from: normalizeE164(input.fromNumber),
    url: whisperAgentUrl(input.sessionId),
    method: "POST",
  });

  const callerTwiml = twiml(
    `<Say>Please hold while we connect you.</Say><Dial><Conference beep="false" endConferenceOnExit="true">${escapeXml(conf)}</Conference></Dial>`,
  );

  return { twiml: callerTwiml };
}

export function buildWhisperAgentTwiml(input: {
  sessionId: string;
  whisperText: string;
  acceptDigit: string;
}): string {
  const action = whisperAcceptUrl(input.sessionId);
  return twiml(
    `<Gather numDigits="1" timeout="15" action="${escapeXml(action)}" method="POST"><Say>${escapeXml(input.whisperText)}</Say></Gather><Hangup/>`,
  );
}

export function buildWhisperAcceptTwiml(sessionId: string, digit: string, acceptDigit: string): string {
  if (digit !== acceptDigit) {
    return twiml("<Say>Goodbye.</Say><Hangup/>");
  }
  const conf = conferenceName(sessionId);
  return twiml(`<Dial><Conference beep="false">${escapeXml(conf)}</Conference></Dial>`);
}

export async function cancelTwilioWhisperAgent(sessionId: string, workspaceId: string) {
  const { loadCallSession } = await import("./session-store");
  const session = await loadCallSession(sessionId);
  const state = (session?.stateJson as SessionState) ?? {};
  const agentSid = state.whisperAgentCallSid;
  if (!agentSid) return;
  const client = await getTwilioClientForWorkspace(workspaceId);
  await client.calls(agentSid).update({ status: "completed" }).catch(() => undefined);
}
