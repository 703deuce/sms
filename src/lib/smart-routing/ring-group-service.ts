import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPrisma } from "@/lib/db";
import { isDestinationAvailable } from "./destination-availability";
import { holdCall, recordCommandReceipt } from "./telnyx-provider";
import { updateSessionState } from "./session-store";
import type { SessionState } from "./types";

export type RingLegState = {
  kind: "smart_routing_ring";
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  parentCallControlId: string;
  legIndex: number;
  mode: "simultaneous" | "sequential";
};

export function decodeRingLegState(raw?: string): RingLegState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as RingLegState;
    if (parsed?.kind === "smart_routing_ring" && parsed.sessionId) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function resolvePhones(workspaceId: string, destinationIds: string[]) {
  const prisma = getPrisma();
  const phones: string[] = [];
  for (const id of destinationIds) {
    const dest = await prisma.smartRoutingDestination.findFirst({
      where: { id, workspaceId },
    });
    if (!dest?.phoneNumber || !isDestinationAvailable(dest)) continue;
    phones.push(dest.phoneNumber.trim());
  }
  return phones.filter(Boolean);
}

export async function startRingGroup(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  callerControlId: string;
  fromNumber: string;
  destinationIds?: string[];
  phoneNumbers?: string[];
  mode: "simultaneous" | "sequential";
  ringIndex?: number;
}) {
  let phones: string[] = [];
  if (input.phoneNumbers?.length) {
    phones = input.phoneNumbers.map((p) => p.trim()).filter(Boolean);
  } else if (input.destinationIds?.length) {
    phones = await resolvePhones(input.workspaceId, input.destinationIds);
  }

  if (!phones.length) return { legs: [], error: "no_destinations" };

  if (!isTelnyxVoiceConfigured()) return { mock: true, legs: [] };

  const connectionId =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID not configured");

  await holdCall(input.callerControlId, input.sessionId);
  await telnyxRequest(`/calls/${input.callerControlId}/actions/speak`, {
    method: "POST",
    body: {
      payload: "Please hold while we connect you.",
      voice: "female",
      language: "en-US",
    },
  }).catch(() => undefined);

  const mode = input.mode;
  const targets =
    mode === "sequential"
      ? phones.slice(input.ringIndex ?? 0, (input.ringIndex ?? 0) + 1)
      : phones;

  const legIds: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    const phone = targets[i];
    const legState: RingLegState = {
      kind: "smart_routing_ring",
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      flowId: input.flowId,
      nodeId: input.nodeId,
      parentCallControlId: input.callerControlId,
      legIndex: mode === "sequential" ? (input.ringIndex ?? 0) + i : i,
      mode,
    };
    const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        from: input.fromNumber,
        to: normalizeE164(phone),
        client_state: Buffer.from(JSON.stringify(legState)).toString("base64"),
      },
    });
    const legId = dialed?.data?.call_control_id;
    if (legId) legIds.push(legId);
  }

  await updateSessionState(input.sessionId, {
    currentNodeId: input.nodeId,
    stateJson: {
      awaitingEvent: "ring_group",
      ringLegIds: legIds,
      ringIndex: input.ringIndex ?? 0,
      ringMode: mode,
      ringPhones: phones,
    } as SessionState,
  });

  await recordCommandReceipt({
    callSessionId: input.sessionId,
    providerCommand: "ring_group_dial",
    request: { mode, legIds, targets },
  });

  return { legs: legIds, mode };
}

export async function handleRingLegAnswered(input: {
  sessionId: string;
  parentCallControlId: string;
  winningLegId: string;
  ringState: RingLegState;
}) {
  const session = await import("./session-store").then((m) => m.loadCallSession(input.sessionId));
  const state = (session?.stateJson as SessionState) ?? {};
  const allLegs = state.ringLegIds ?? [];

  for (const legId of allLegs) {
    if (legId !== input.winningLegId) {
      await telnyxRequest(`/calls/${legId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
  }

  await telnyxRequest(`/calls/${input.parentCallControlId}/actions/unhold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${input.parentCallControlId}/actions/bridge`, {
    method: "POST",
    body: { call_control_id: input.winningLegId },
  }).catch(() => undefined);

  await updateSessionState(input.sessionId, {
    answeredAt: new Date(),
    finalOutcome: "connected",
    stateJson: { awaitingEvent: undefined } as SessionState,
    completedAt: new Date(),
  });

  return { connected: true };
}
