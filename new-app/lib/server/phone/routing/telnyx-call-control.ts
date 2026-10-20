import { randomUUID } from "crypto";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { encodeTelnyxClientState, telnyxCallAction, telnyxCallControlPath } from "@/lib/server/phone/telnyx-call-actions";
import { getPhoneCallControlConnectionId } from "@/lib/server/telephony/config";

export function newCommandId(prefix = "cf") {
  return `${prefix}_${randomUUID()}`;
}

export async function answerCall(callControlId: string, clientState?: Record<string, unknown>) {
  await telnyxCallAction(callControlId, "answer", {
    ...(clientState ? { client_state: encodeTelnyxClientState(clientState) } : {}),
  });
}

export async function gatherUsingSpeak(input: {
  callControlId: string;
  text: string;
  validDigits: string;
  voice?: string;
  language?: string;
  timeoutMs?: number;
  maxTries?: number;
  invalidPayload?: string;
  clientState: Record<string, unknown>;
}) {
  await telnyxCallAction(input.callControlId, "gather_using_speak", {
    payload: input.text,
    voice: input.voice || "Telnyx.KokoroTTS.af",
    language: input.language || "en-US",
    valid_digits: input.validDigits,
    minimum_digits: 1,
    maximum_digits: 1,
    maximum_tries: input.maxTries ?? 2,
    timeout_millis: input.timeoutMs ?? 5000,
    ...(input.invalidPayload ? { invalid_payload: input.invalidPayload } : {}),
    client_state: encodeTelnyxClientState(input.clientState),
    command_id: newCommandId("gather"),
  });
}

export async function gatherUsingAudio(input: {
  callControlId: string;
  audioUrl: string;
  validDigits: string;
  timeoutMs?: number;
  clientState: Record<string, unknown>;
}) {
  await telnyxCallAction(input.callControlId, "gather_using_audio", {
    audio_url: input.audioUrl,
    valid_digits: input.validDigits,
    minimum_digits: 1,
    maximum_digits: 1,
    timeout_millis: input.timeoutMs ?? 5000,
    client_state: encodeTelnyxClientState(input.clientState),
    command_id: newCommandId("gather_audio"),
  });
}

export async function speakOnCall(callControlId: string, text: string, clientState?: Record<string, unknown>) {
  await telnyxCallAction(callControlId, "speak", {
    payload: text,
    voice: "Telnyx.KokoroTTS.af",
    language: "en-US",
    ...(clientState ? { client_state: encodeTelnyxClientState(clientState) } : {}),
    command_id: newCommandId("speak"),
  });
}

export async function hangupCall(callControlId: string) {
  await telnyxCallAction(callControlId, "hangup", { command_id: newCommandId("hangup") });
}

export async function bridgeCalls(inboundControlId: string, outboundControlId: string) {
  await telnyxCallAction(inboundControlId, "bridge", {
    call_control_id: outboundControlId,
    command_id: newCommandId("bridge"),
  });
}

export async function dialPstnLeg(input: {
  connectionId: string;
  toE164: string;
  fromE164: string;
  linkToControlId: string;
  timeoutSec: number;
  clientState: Record<string, unknown>;
  bridgeOnAnswer?: boolean;
}) {
  const body = {
    connection_id: input.connectionId,
    to: input.toE164,
    from: input.fromE164,
    client_state: encodeTelnyxClientState(input.clientState),
    timeout_secs: input.timeoutSec,
    link_to: input.linkToControlId,
    bridge_intent: true,
    bridge_on_answer: input.bridgeOnAnswer ?? true,
    prevent_double_bridge: true,
    command_id: newCommandId("dial"),
  };
  return telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body,
  });
}

export function requireCallControlConnectionId() {
  const id = getPhoneCallControlConnectionId();
  if (!id) throw new Error("TELNYX_CALL_CONTROL_APP_ID is not configured");
  return id;
}
