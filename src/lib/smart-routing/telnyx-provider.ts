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
      client_state: encodeClientState(input.clientState),
    },
    input.sessionId,
  );
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
  return telnyxAction(callControlId, "record_start", { format: "mp3" }, sessionId);
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
