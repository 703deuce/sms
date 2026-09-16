import "server-only";

import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { gatherUsingSpeakRaw } from "@/lib/smart-routing/telnyx-provider";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "../after-hours-handling-config";
import type { VoiceV2TransferAttemptResult } from "../after-hours-handling-types";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "../intake/session-store";
import { executeVoiceV2TransferPlanFromStep } from "./transfer-executor";
import { VoiceV2TelnyxCallControlTransferProvider } from "./telnyx-transfer-provider";
import {
  getWarmTransferSessionByConsultControlId,
  getWarmTransferSessionById,
  saveWarmTransferSession,
} from "./warm-transfer-store";
import type { VoiceV2WarmClientState, VoiceV2WarmTransferSession } from "./warm-transfer-types";

function encodeClientState(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeClientState(raw: unknown): VoiceV2WarmClientState | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (parsed.kind !== "voice_v2_warm_transfer_consult") return null;
    return parsed as VoiceV2WarmClientState;
  } catch {
    return null;
  }
}

async function resolveDialFromE164(
  workspaceId: string,
  callerCallControlId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { workspaceId, telnyxCallControlId: callerCallControlId },
    select: { toE164: true },
  });
  const raw = call?.toE164?.trim();
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return null;
  }
}

export type StartWarmTransferInput = {
  workspaceId: string;
  agentId: string;
  sessionKey: string;
  invocationId: string;
  planId: string;
  transferGeneration: number;
  stepOrder: number;
  destinationId: string;
  destinationE164: string;
  callerCallControlId: string;
  briefingText: string;
  timeoutSeconds: number;
  /** Test-only: skip Telnyx dial */
  mockConsultControlId?: string;
};

export async function startVoiceV2WarmTransfer(
  input: StartWarmTransferInput,
): Promise<{ sessionId: string; result: "INITIATING" | VoiceV2TransferAttemptResult }> {
  const fromE164 = await resolveDialFromE164(input.workspaceId, input.callerCallControlId);
  if (!fromE164 && !input.mockConsultControlId) {
    return { sessionId: "", result: "PROVIDER_ERROR" };
  }

  const id = randomUUID();
  const stepAttemptId = `${input.transferGeneration}:${input.stepOrder}`;
  const session: VoiceV2WarmTransferSession = {
    id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    sessionKey: input.sessionKey,
    invocationId: input.invocationId,
    planId: input.planId,
    transferGeneration: input.transferGeneration,
    stepOrder: input.stepOrder,
    stepAttemptId,
    destinationId: input.destinationId,
    destinationE164: input.destinationE164,
    callerCallControlId: input.callerCallControlId,
    fromE164: fromE164 || "+15550000001",
    briefingText: input.briefingText,
    timeoutSeconds: input.timeoutSeconds,
    phase: "INITIATING",
    dtmfReplayUsed: false,
    bridgeCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (input.mockConsultControlId) {
    session.consultationCallControlId = input.mockConsultControlId;
    session.phase = "CONSULT_RINGING";
    await saveWarmTransferSession(session);
    return { sessionId: id, result: "INITIATING" };
  }

  if (!isTelnyxVoiceConfigured()) {
    return { sessionId: "", result: "PROVIDER_ERROR" };
  }

  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  if (!connectionId) return { sessionId: "", result: "PROVIDER_ERROR" };

  await telnyxRequest(`/calls/${input.callerCallControlId}/actions/hold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  const clientState: VoiceV2WarmClientState = {
    kind: "voice_v2_warm_transfer_consult",
    warmSessionId: id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    sessionKey: input.sessionKey,
    invocationId: input.invocationId,
    transferGeneration: input.transferGeneration,
    stepOrder: input.stepOrder,
    callerControlId: input.callerCallControlId,
  };

  const consultBody: Record<string, unknown> = {
    connection_id: connectionId,
    from: session.fromE164,
    to: input.destinationE164,
    client_state: encodeClientState(clientState),
    answering_machine_detection: "detect",
  };

  let consultControlId: string | undefined;
  try {
    const consultLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
      method: "POST",
      body: consultBody,
    });
    consultControlId = consultLeg.data?.call_control_id;
  } catch {
    return { sessionId: "", result: "PROVIDER_ERROR" };
  }

  if (!consultControlId) return { sessionId: "", result: "PROVIDER_ERROR" };

  session.consultationCallControlId = consultControlId;
  session.phase = "CONSULT_RINGING";
  await saveWarmTransferSession(session);

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "voice_v2_warm_transfer_timeout",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: { warmSessionId: id },
    idempotencyKey: `voice-v2-warm-timeout-${id}`,
    runAfter: new Date(Date.now() + input.timeoutSeconds * 1000),
  }).catch(() => undefined);

  return { sessionId: id, result: "INITIATING" };
}

function isStaleSession(
  session: VoiceV2WarmTransferSession,
  client: VoiceV2WarmClientState,
): boolean {
  if (session.transferGeneration !== client.transferGeneration) return true;
  if (session.stepOrder !== client.stepOrder) return true;
  if (session.invocationId !== client.invocationId) return true;
  if (session.bridgeCompleted) return true;
  if (session.phase === "FAILED" || session.phase === "CANCELLED" || session.phase === "BRIDGED") {
    return true;
  }
  return false;
}

async function patchSession(
  session: VoiceV2WarmTransferSession,
  patch: Partial<VoiceV2WarmTransferSession>,
): Promise<VoiceV2WarmTransferSession> {
  const next = { ...session, ...patch, updatedAt: new Date().toISOString() };
  await saveWarmTransferSession(next);
  return next;
}

async function startPress1Gather(session: VoiceV2WarmTransferSession, replay: boolean) {
  const consultId = session.consultationCallControlId;
  if (!consultId) return;
  if (consultId.startsWith("mock_")) {
    await patchSession(session, {
      phase: "GATHERING",
      dtmfReplayUsed: replay || session.dtmfReplayUsed,
    });
    return;
  }
  if (!isTelnyxVoiceConfigured()) return;

  const clientState: VoiceV2WarmClientState = {
    kind: "voice_v2_warm_transfer_consult",
    warmSessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    sessionKey: session.sessionKey,
    invocationId: session.invocationId,
    transferGeneration: session.transferGeneration,
    stepOrder: session.stepOrder,
    callerControlId: session.callerCallControlId,
    gatherPhase: replay ? "replay" : "accept",
  };

  const text = replay
    ? "Press 1 to accept this call."
    : session.briefingText;

  await gatherUsingSpeakRaw({
    callControlId: consultId,
    text,
    validDigits: "1",
    maxDigits: 1,
    timeoutMs: 12_000,
    clientStateBase64: encodeClientState(clientState),
  }).catch(() => undefined);

  await patchSession(session, { phase: "GATHERING", dtmfReplayUsed: replay || session.dtmfReplayUsed });
}

async function bridgeWarmTransfer(session: VoiceV2WarmTransferSession): Promise<boolean> {
  if (session.bridgeCompleted) return true;
  const consultId = session.consultationCallControlId;
  if (!consultId) return false;
  if (consultId.startsWith("mock_")) {
    await patchSession(session, { phase: "BRIDGING" });
    return true;
  }
  if (!isTelnyxVoiceConfigured()) return false;

  await patchSession(session, { phase: "BRIDGING" });

  await telnyxRequest(`/calls/${session.callerCallControlId}/actions/unhold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  try {
    await telnyxRequest(`/calls/${session.callerCallControlId}/actions/bridge`, {
      method: "POST",
      body: { call_control_id: consultId },
    });
  } catch {
    await failWarmTransfer(session, "BRIDGE_FAILED");
    return false;
  }

  return true;
}

async function hangupConsult(session: VoiceV2WarmTransferSession) {
  const consultId = session.consultationCallControlId;
  if (consultId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${consultId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }
}

export async function markVoiceV2WarmBridgeSucceeded(warmSessionId: string): Promise<void> {
  const session = await getWarmTransferSessionById(warmSessionId);
  if (!session || session.bridgeCompleted) return;

  const ctx = getVoiceV2CallContext(session.sessionKey);
  if (!ctx) return;

  const activeGen = ctx.afterHours?.transfer?.transferGeneration ?? 0;
  if (activeGen > session.transferGeneration) {
    return;
  }

  await patchSession(session, { phase: "BRIDGED", bridgeCompleted: true });

  setVoiceV2CallContext({
    ...ctx,
    afterHours: {
      ...ctx.afterHours,
      transfer: {
        status: "SUCCEEDED",
        transferGeneration: session.transferGeneration,
        planId: session.planId,
        currentStepOrder: session.stepOrder,
        currentDestinationId: session.destinationId,
        lastResult: "SUCCESS",
        invocationId: session.invocationId,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

async function failWarmTransfer(
  session: VoiceV2WarmTransferSession,
  result: VoiceV2TransferAttemptResult,
): Promise<void> {
  if (session.phase === "BRIDGED" || session.bridgeCompleted) return;
  await hangupConsult(session);
  await patchSession(session, { phase: "FAILED", lastFailure: result });

  const ctx = getVoiceV2CallContext(session.sessionKey);
  if (!ctx) return;

  const runtime = await loadVoiceAgentRuntimeConfig(session.workspaceId, session.agentId);
  const config = resolveAfterHoursHandlingFromAgentConfig(parseVoiceAgentConfig(runtime));
  if (!config) return;

  const provider = new VoiceV2TelnyxCallControlTransferProvider();
  const continuation = await executeVoiceV2TransferPlanFromStep({
    ctx,
    config,
    provider,
    callControlId: session.callerCallControlId,
    invocationId: session.invocationId,
    planId: session.planId,
    transferGeneration: session.transferGeneration,
    afterFailedStepOrder: session.stepOrder,
    lastResult: result,
  });

  setVoiceV2CallContext({
    ...ctx,
    afterHours: {
      ...ctx.afterHours,
      transfer: continuation.transfer,
      pendingHandlingAction: continuation.ok ? undefined : "CALLBACK",
    },
  });
}

export async function handleVoiceV2WarmTransferConsultAnswered(input: {
  consultControlId: string;
  clientStateRaw: unknown;
}): Promise<{ handled: boolean }> {
  const client = decodeClientState(input.clientStateRaw);
  if (!client) return { handled: false };

  const session = await getWarmTransferSessionById(client.warmSessionId);
  if (!session || isStaleSession(session, client)) return { handled: true };

  await patchSession(session, {
    consultationCallControlId: input.consultControlId,
    phase: "CONSULT_ANSWERED",
  });
  await startPress1Gather(session, false);
  return { handled: true };
}

export async function handleVoiceV2WarmTransferGather(input: {
  eventType: string;
  consultControlId: string;
  digits: string;
  clientStateRaw: unknown;
}): Promise<{ handled: boolean }> {
  const client = decodeClientState(input.clientStateRaw);
  if (!client) return { handled: false };

  const session =
    (await getWarmTransferSessionById(client.warmSessionId)) ||
    (await getWarmTransferSessionByConsultControlId(input.consultControlId));
  if (!session || isStaleSession(session, client)) return { handled: true };

  const digit = input.digits.trim();
  if (digit === "1") {
    const bridged = await bridgeWarmTransfer(session);
    if (!bridged) return { handled: true };
    return { handled: true };
  }

  if (!session.dtmfReplayUsed) {
    await patchSession(session, { dtmfReplayUsed: true });
    await startPress1Gather(session, true);
    return { handled: true };
  }

  await failWarmTransfer(session, digit ? "DECLINED" : "TIMEOUT");
  return { handled: true };
}

export async function handleVoiceV2WarmTransferAmd(input: {
  consultControlId: string;
  amdResult: string;
  clientStateRaw?: unknown;
}): Promise<{ handled: boolean }> {
  const client = input.clientStateRaw ? decodeClientState(input.clientStateRaw) : null;
  const session =
    (client ? await getWarmTransferSessionById(client.warmSessionId) : null) ||
    (await getWarmTransferSessionByConsultControlId(input.consultControlId));
  if (!session) return { handled: false };

  const amd = input.amdResult.toLowerCase();
  if (amd.includes("machine") || amd.includes("voicemail")) {
    await failWarmTransfer(session, "NO_ANSWER");
    return { handled: true };
  }
  return { handled: false };
}

export async function handleVoiceV2WarmTransferCallerHangup(
  callerCallControlId: string,
): Promise<{ handled: boolean }> {
  const session = await import("./warm-transfer-store").then((m) =>
    m.getWarmTransferSessionByCallerControlId(callerCallControlId),
  );
  if (!session || session.bridgeCompleted) return { handled: false };
  await hangupConsult(session);
  await patchSession(session, { phase: "CANCELLED", lastFailure: "CALLER_DISCONNECTED" });
  return { handled: true };
}

export async function handleVoiceV2WarmTransferTimeoutJob(payload: {
  warmSessionId: string;
}): Promise<{ ok: boolean }> {
  const session = await getWarmTransferSessionById(payload.warmSessionId);
  if (!session) return { ok: false };
  if (session.bridgeCompleted || session.phase === "BRIDGED") return { ok: true };
  if (session.phase === "BRIDGING") {
    return { ok: true };
  }
  await failWarmTransfer(session, "TIMEOUT");
  return { ok: true };
}

/** Test / mock driver */
export async function driveMockVoiceV2WarmTransfer(
  sessionId: string,
  event: "consult_answered" | "press_1" | "timeout" | "voicemail",
): Promise<VoiceV2TransferAttemptResult | "INITIATING" | "PENDING_BRIDGE"> {
  const session = await getWarmTransferSessionById(sessionId);
  if (!session) return "PROVIDER_ERROR";

  const clientState = encodeClientState({
    kind: "voice_v2_warm_transfer_consult",
    warmSessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    sessionKey: session.sessionKey,
    invocationId: session.invocationId,
    transferGeneration: session.transferGeneration,
    stepOrder: session.stepOrder,
    callerControlId: session.callerCallControlId,
  });

  if (event === "consult_answered") {
    await handleVoiceV2WarmTransferConsultAnswered({
      consultControlId: session.consultationCallControlId || "mock_consult",
      clientStateRaw: clientState,
    });
    return "INITIATING";
  }
  if (event === "press_1") {
    await handleVoiceV2WarmTransferGather({
      eventType: "call.dtmf.received",
      consultControlId: session.consultationCallControlId || "mock_consult",
      digits: "1",
      clientStateRaw: clientState,
    });
    await markVoiceV2WarmBridgeSucceeded(sessionId);
    return "SUCCESS";
  }
  if (event === "voicemail") {
    await handleVoiceV2WarmTransferAmd({
      consultControlId: session.consultationCallControlId || "mock_consult",
      amdResult: "machine",
      clientStateRaw: clientState,
    });
    const updated = await getWarmTransferSessionById(sessionId);
    return updated?.lastFailure || "NO_ANSWER";
  }
  await handleVoiceV2WarmTransferTimeoutJob({ warmSessionId: sessionId });
  const updated = await getWarmTransferSessionById(sessionId);
  return updated?.lastFailure || "TIMEOUT";
}

export function parseVoiceV2WarmClientState(raw: unknown): VoiceV2WarmClientState | null {
  return decodeClientState(raw);
}
