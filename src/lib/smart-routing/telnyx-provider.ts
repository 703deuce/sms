import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";

export type SmartRoutingClientState = {
  kind: "smart_routing";
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId?: string;
  awaiting?: string;
};

export type SmartRoutingLegKind =
  | "smart_routing"
  | "smart_routing_whisper"
  | "smart_routing_ring"
  | "smart_routing_record";

export function decodeAnySmartRoutingState(raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function encodeClientState(state: SmartRoutingClientState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function decodeClientState(raw?: string): SmartRoutingClientState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as SmartRoutingClientState;
    if (parsed?.kind === "smart_routing" && parsed.sessionId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function recordCommandReceipt(input: {
  callSessionId: string;
  providerCommand: string;
  request?: unknown;
  response?: unknown;
  status?: string;
  idempotencyKey?: string;
}) {
  const prisma = getPrisma();
  const idempotencyKey =
    input.idempotencyKey ?? `sr:${input.callSessionId}:${input.providerCommand}:${randomUUID()}`;
  try {
    await prisma.smartRoutingCommandReceipt.create({
      data: {
        callSessionId: input.callSessionId,
        internalOperationId: randomUUID(),
        provider: "telnyx",
        providerCommand: input.providerCommand,
        idempotencyKey,
        requestJson: (input.request ?? {}) as object,
        responseJson: (input.response ?? {}) as object,
        status: input.status ?? "completed",
      },
    });
  } catch {
    // duplicate idempotency — safe to ignore
  }
  return idempotencyKey;
}

async function telnyxAction(
  callControlId: string,
  action: string,
  body: Record<string, unknown>,
  sessionId?: string,
) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) {
    return { mock: true };
  }
  const res = await telnyxRequest(`/calls/${callControlId}/actions/${action}`, {
    method: "POST",
    body,
  });
  if (sessionId) {
    await recordCommandReceipt({
      callSessionId: sessionId,
      providerCommand: action,
      request: body,
      response: res,
    });
  }
  return res;
}

export async function answerCall(callControlId: string, sessionId?: string) {
  return telnyxAction(callControlId, "answer", {}, sessionId);
}

export async function hangupCall(callControlId: string, sessionId?: string) {
  return telnyxAction(callControlId, "hangup", {}, sessionId);
}

export async function speakOnCall(
  callControlId: string,
  text: string,
  clientState?: SmartRoutingClientState,
  sessionId?: string,
) {
  return telnyxAction(
    callControlId,
    "speak",
    {
      payload: text,
      voice: "female",
      language: "en-US",
      client_state: clientState ? encodeClientState(clientState) : undefined,
    },
    sessionId,
  );
}

export async function speakOnCallRaw(
  callControlId: string,
  text: string,
  clientStateBase64?: string,
) {
  return telnyxAction(callControlId, "speak", {
    payload: text,
    voice: "female",
    language: "en-US",
    ...(clientStateBase64 ? { client_state: clientStateBase64 } : {}),
  });
}

export async function playbackOnCall(
  callControlId: string,
  audioUrl: string,
  clientState?: SmartRoutingClientState,
  sessionId?: string,
) {
  return telnyxAction(
    callControlId,
    "playback_start",
    {
      audio_url: audioUrl,
      client_state: clientState ? encodeClientState(clientState) : undefined,
    },
    sessionId,
  );
}

export async function gatherUsingSpeak(input: {
  callControlId: string;
  text: string;
  validDigits: string;
  maxDigits?: number;
  timeoutMs?: number;
  finishOnKey?: string;
  clientState: SmartRoutingClientState;
  sessionId?: string;
}) {
  return telnyxAction(
    input.callControlId,
    "gather_using_speak",
    {
      payload: input.text,
      voice: "female",
      language: "en-US",
      valid_digits: input.validDigits,
      maximum_digits: input.maxDigits ?? 1,
      minimum_digits: 1,
      timeout_millis: input.timeoutMs ?? 10000,
      ...(input.finishOnKey ? { terminating_digit: input.finishOnKey } : {}),
      client_state: encodeClientState(input.clientState),
    },
    input.sessionId,
  );
}

/** Gather with arbitrary base64 client_state (employee access, etc.). */
export async function gatherUsingSpeakRaw(input: {
  callControlId: string;
  text: string;
  validDigits: string;
  maxDigits?: number;
  timeoutMs?: number;
  finishOnKey?: string;
  clientStateBase64: string;
}) {
  return telnyxAction(input.callControlId, "gather_using_speak", {
    payload: input.text,
    voice: "female",
    language: "en-US",
    valid_digits: input.validDigits,
    maximum_digits: input.maxDigits ?? 1,
    minimum_digits: 1,
    timeout_millis: input.timeoutMs ?? 10000,
    ...(input.finishOnKey ? { terminating_digit: input.finishOnKey } : {}),
    client_state: input.clientStateBase64,
  });
}

export async function gatherUsingAudio(input: {
  callControlId: string;
  audioUrl: string;
  validDigits: string;
  maxDigits?: number;
  timeoutMs?: number;
  clientState: SmartRoutingClientState;
  sessionId?: string;
}) {
  return telnyxAction(
    input.callControlId,
    "gather_using_audio",
    {
      audio_url: input.audioUrl,
      valid_digits: input.validDigits,
      maximum_digits: input.maxDigits ?? 1,
      minimum_digits: 1,
      timeout_millis: input.timeoutMs ?? 10000,
      client_state: encodeClientState(input.clientState),
    },
    input.sessionId,
  );
}

export async function transferToPhone(
  callControlId: string,
  to: string,
  sessionId?: string,
  clientState?: SmartRoutingClientState,
) {
  return telnyxAction(
    callControlId,
    "transfer",
    {
      to,
      client_state: clientState ? encodeClientState(clientState) : undefined,
    },
    sessionId,
  );
}

export async function startRecording(callControlId: string, sessionId?: string) {
  return telnyxAction(
    callControlId,
    "record_start",
    { format: "mp3", channels: "dual" },
    sessionId,
  );
}

export async function bridgeCalls(
  callControlId: string,
  otherControlId: string,
  sessionId?: string,
) {
  return telnyxAction(
    callControlId,
    "bridge",
    { call_control_id: otherControlId },
    sessionId,
  );
}

export async function holdCall(callControlId: string, sessionId?: string) {
  return telnyxAction(callControlId, "hold", {}, sessionId);
}

export async function unholdCall(callControlId: string, sessionId?: string) {
  return telnyxAction(callControlId, "unhold", {}, sessionId);
}

export async function dialOutbound(input: {
  connectionId: string;
  from: string;
  to: string;
  clientState: Record<string, unknown>;
  sessionId?: string;
}) {
  if (!isTelnyxVoiceConfigured()) return { mock: true, call_control_id: "mock_leg" };
  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: input.connectionId,
      from: input.from,
      to: input.to,
      client_state: Buffer.from(JSON.stringify(input.clientState)).toString("base64"),
    },
  });
  if (input.sessionId) {
    await recordCommandReceipt({
      callSessionId: input.sessionId,
      providerCommand: "dial",
      request: input,
      response: res,
    });
  }
  return res?.data;
}
