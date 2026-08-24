import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  bridgeCalls,
  encodeClientState,
  gatherUsingSpeak,
  holdCall,
  recordCommandReceipt,
  speakOnCall,
  unholdCall,
} from "./telnyx-provider";
import { updateSessionState } from "./session-store";
import type { SessionState } from "./types";

export type WhisperLegState = {
  kind: "smart_routing_whisper";
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  parentCallControlId: string;
};

export function decodeWhisperState(raw?: string): WhisperLegState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as WhisperLegState;
    if (parsed?.kind === "smart_routing_whisper" && parsed.sessionId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function startWhisperTransfer(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  callerControlId: string;
  agentPhone: string;
  fromNumber: string;
  whisperText: string;
  acceptDigit?: string;
  timeoutMs?: number;
}) {
  if (!isTelnyxVoiceConfigured()) return { mock: true };

  await holdCall(input.callerControlId, input.sessionId);
  await speakOnCall(
    input.callerControlId,
    "Please hold while we connect you.",
    undefined,
    input.sessionId,
  );

  const connectionId =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!connectionId) throw new Error("TELNYX_CONNECTION_ID not configured");

  const whisperState: WhisperLegState = {
    kind: "smart_routing_whisper",
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: input.nodeId,
    parentCallControlId: input.callerControlId,
  };

  const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from: input.fromNumber,
      to: normalizeE164(input.agentPhone),
      client_state: Buffer.from(JSON.stringify(whisperState)).toString("base64"),
    },
  });

  const agentLegId = dialed?.data?.call_control_id;
  if (!agentLegId) throw new Error("Whisper dial failed");

  await updateSessionState(input.sessionId, {
    stateJson: {
      awaitingEvent: "whisper",
      whisperAgentControlId: agentLegId,
      whisperText: input.whisperText,
      acceptDigit: input.acceptDigit ?? "1",
      whisperAgentPhone: input.agentPhone,
    } as SessionState,
    currentNodeId: input.nodeId,
  });

  await recordCommandReceipt({
    callSessionId: input.sessionId,
    providerCommand: "whisper_dial",
    request: { to: input.agentPhone, agentLegId },
  });

  return { agentLegId };
}

export async function handleWhisperAgentAnswered(input: {
  agentControlId: string;
  whisperState: WhisperLegState;
  whisperText: string;
  acceptDigit?: string;
  timeoutMs?: number;
}) {
  const digit = input.acceptDigit ?? "1";
  await gatherUsingSpeak({
    callControlId: input.agentControlId,
    text: input.whisperText,
    validDigits: digit,
    timeoutMs: input.timeoutMs ?? 8000,
    clientState: {
      kind: "smart_routing",
      sessionId: input.whisperState.sessionId,
      workspaceId: input.whisperState.workspaceId,
      flowId: input.whisperState.flowId,
      nodeId: input.whisperState.nodeId,
      awaiting: "whisper_accept",
    },
    sessionId: input.whisperState.sessionId,
  });
  return { awaiting: "whisper_accept" };
}

export async function completeWhisperAccept(input: {
  sessionId: string;
  parentCallControlId: string;
  agentControlId: string;
  workspaceId?: string;
}) {
  const session = await import("./session-store").then((m) => m.loadCallSession(input.sessionId));
  if (session) {
    const { maybePlayRecordingAnnouncement } = await import("./recording-announcement");
    await maybePlayRecordingAnnouncement({
      workspaceId: session.workspaceId,
      customerCallControlId: input.parentCallControlId,
      sessionId: input.sessionId,
      direction: "inbound",
    });
  }

  await unholdCall(input.parentCallControlId, input.sessionId);
  await bridgeCalls(input.parentCallControlId, input.agentControlId, input.sessionId);

  if (session) {
    const state = (session.stateJson as SessionState) ?? {};
    const agentPhone = state.whisperAgentPhone as string | undefined;
    const { registerConnectedCallControl } = await import("./call-control-service");
    await registerConnectedCallControl({
      workspaceId: session.workspaceId,
      callSessionId: input.sessionId,
      employeeCallControlId: input.agentControlId,
      customerCallControlId: input.parentCallControlId,
      employeePhoneE164: agentPhone,
    });
  }

  await updateSessionState(input.sessionId, {
    answeredAt: new Date(),
    stateJson: { awaitingEvent: undefined, whisperPending: false } as SessionState,
    finalOutcome: "connected",
  });
  return { connected: true };
}

export async function cancelWhisperLeg(agentControlId: string, sessionId?: string) {
  await telnyxRequest(`/calls/${agentControlId}/actions/hangup`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
  if (sessionId) {
    await recordCommandReceipt({
      callSessionId: sessionId,
      providerCommand: "whisper_cancel",
      request: { agentControlId },
    });
  }
}
