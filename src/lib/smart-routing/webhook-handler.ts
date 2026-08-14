import "server-only";

import { decodeClientState, decodeAnySmartRoutingState } from "./telnyx-provider";
import {
  handleGatherResult,
  handleTransferResult,
  finalizeSession,
} from "./flow-runtime";
import { loadCallSession } from "./session-store";
import { resolveActiveFlowForNumber } from "./flow-service";
import { getPrisma } from "@/lib/db";
import {
  decodeWhisperState,
  handleWhisperAgentAnswered,
  completeWhisperAccept,
  cancelWhisperLeg,
} from "./whisper-service";
import {
  decodeRingLegState,
  handleRingLegAnswered,
} from "./ring-group-service";
import {
  handleRecordByPhoneAnswered,
  finalizeRecordByPhone,
  type RecordByPhoneState,
} from "./record-by-phone-service";
import type { SessionState } from "./types";
import { emitSmartRoutingEvent } from "./events";

export async function tryStartSmartRoutingInbound(input: {
  workspaceId: string;
  phoneNumberId: string;
  fromE164: string;
  toE164: string;
  callControlId: string;
  forwardedFrom?: string;
}) {
  const flow = await resolveActiveFlowForNumber(input.workspaceId, input.phoneNumberId);
  if (!flow?.publishedVersionId) return { started: false as const };

  const { startFlowForInboundCall } = await import("./flow-runtime");
  const session = await startFlowForInboundCall({
    workspaceId: input.workspaceId,
    flowId: flow.id,
    flowVersionId: flow.publishedVersionId,
    callerNumber: input.fromE164,
    calledNumber: input.toE164,
    callControlId: input.callControlId,
    forwardedFrom: input.forwardedFrom,
  });
  return { started: true as const, sessionId: session.id };
}

async function handleLegEvents(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}) {
  const rawState =
    typeof input.eventPayload.client_state === "string"
      ? input.eventPayload.client_state
      : undefined;
  const anyState = decodeAnySmartRoutingState(rawState);

  if (anyState?.kind === "smart_routing_record" && input.eventType === "call.answered") {
    const state = anyState as unknown as RecordByPhoneState;
    await handleRecordByPhoneAnswered({
      callControlId: String(input.eventPayload.call_control_id ?? ""),
      state,
    });
    return { handled: true as const, kind: "record_by_phone" };
  }

  if (
    anyState?.kind === "smart_routing_record" &&
    input.eventType === "call.recording.saved"
  ) {
    const state = anyState as unknown as RecordByPhoneState;
    const url = String(
      (input.eventPayload.recording_urls as { mp3?: string })?.mp3 ??
        input.eventPayload.recording_url ??
        "",
    );
    if (url) {
      await finalizeRecordByPhone({
        workspaceId: state.workspaceId,
        state,
        recordingUrl: url,
      });
      await telnyxHangup(String(input.eventPayload.call_control_id ?? ""));
    }
    return { handled: true as const, kind: "record_saved" };
  }

  const whisperState = decodeWhisperState(rawState);
  if (whisperState) {
    const agentControlId = String(input.eventPayload.call_control_id ?? "");
    if (input.eventType === "call.answered") {
      const session = await loadCallSession(whisperState.sessionId);
      const state = (session?.stateJson as SessionState) ?? {};
      await handleWhisperAgentAnswered({
        agentControlId,
        whisperState,
        whisperText: state.whisperText ?? "Incoming business call. Press 1 to accept.",
        acceptDigit: state.acceptDigit ?? "1",
      });
      return { handled: true as const, kind: "whisper_prompt" };
    }
    if (
      input.eventType === "call.gather.ended" ||
      input.eventType === "call.dtmf.received"
    ) {
      const digit = String(input.eventPayload.digits ?? input.eventPayload.digit ?? "").trim();
      if (digit === (whisperState as unknown as { acceptDigit?: string }).acceptDigit || digit === "1") {
        await completeWhisperAccept({
          sessionId: whisperState.sessionId,
          parentCallControlId: whisperState.parentCallControlId,
          agentControlId: agentControlId,
        });
        await finalizeSession(whisperState.sessionId, "connected");
        return { handled: true as const, kind: "whisper_accepted" };
      }
      await cancelWhisperLeg(agentControlId, whisperState.sessionId);
      const { handleTransferResult } = await import("./flow-runtime");
      return {
        handled: true as const,
        ...(await handleTransferResult({
          sessionId: whisperState.sessionId,
          answered: false,
        })),
      };
    }
    if (input.eventType === "call.hangup") {
      const { handleTransferResult } = await import("./flow-runtime");
      return {
        handled: true as const,
        ...(await handleTransferResult({
          sessionId: whisperState.sessionId,
          answered: false,
        })),
      };
    }
  }

  const ringState = decodeRingLegState(rawState);
  if (ringState && input.eventType === "call.answered") {
    await handleRingLegAnswered({
      sessionId: ringState.sessionId,
      parentCallControlId: ringState.parentCallControlId,
      winningLegId: String(input.eventPayload.call_control_id ?? ""),
      ringState,
    });
    await emitSmartRoutingEvent({
      workspaceId: ringState.workspaceId,
      type: "TRANSFER_ANSWERED",
      sessionId: ringState.sessionId,
    });
    return { handled: true as const, kind: "ring_connected" };
  }

  if (ringState && input.eventType === "call.hangup") {
    const session = await loadCallSession(ringState.sessionId);
    const state = (session?.stateJson as SessionState) ?? {};
    if (ringState.mode === "sequential" && state.ringPhones) {
      const nextIdx = (state.ringIndex ?? 0) + 1;
      if (nextIdx < state.ringPhones.length && session) {
        const { startRingGroup } = await import("./ring-group-service");
        await startRingGroup({
          sessionId: ringState.sessionId,
          workspaceId: ringState.workspaceId,
          flowId: ringState.flowId,
          nodeId: ringState.nodeId,
          callerControlId: ringState.parentCallControlId,
          fromNumber: session.calledNumber,
          phoneNumbers: state.ringPhones,
          mode: "sequential",
          ringIndex: nextIdx,
        });
        return { handled: true as const, kind: "ring_next" };
      }
    }
    return {
      handled: true as const,
      ...(await handleTransferResult({
        sessionId: ringState.sessionId,
        answered: false,
      })),
    };
  }

  return { handled: false as const };
}

async function telnyxHangup(controlId: string) {
  const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
  await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
}

export async function processSmartRoutingWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}) {
  const leg = await handleLegEvents(input);
  if (leg.handled) return leg;

  const clientState = decodeClientState(
    typeof input.eventPayload.client_state === "string"
      ? input.eventPayload.client_state
      : undefined,
  );
  if (!clientState?.sessionId) return { handled: false as const };

  const session = await loadCallSession(clientState.sessionId);
  if (!session) return { handled: false as const };

  if (
    input.eventType === "call.gather.ended" ||
    input.eventType === "call.dtmf.received"
  ) {
    if (clientState.awaiting === "whisper_accept") {
      const digit = String(input.eventPayload.digits ?? input.eventPayload.digit ?? "").trim();
      const state = (session.stateJson as SessionState) ?? {};
      if (digit === state.acceptDigit || digit === "1") {
        const agentControlId = String(input.eventPayload.call_control_id ?? "");
        const parentId = state.whisperAgentControlId
          ? session.callControlId
          : session.callControlId;
        if (parentId && agentControlId) {
          await completeWhisperAccept({
            sessionId: clientState.sessionId,
            parentCallControlId: parentId!,
            agentControlId,
          });
          await finalizeSession(clientState.sessionId, "connected");
        }
        return { handled: true as const, outcome: "connected" };
      }
    }
    const digits =
      String(input.eventPayload.digits ?? input.eventPayload.digit ?? "").trim();
    const status = String(input.eventPayload.status ?? "");
    const result = await handleGatherResult({
      sessionId: clientState.sessionId,
      digit: digits.charAt(0) || undefined,
      status,
    });
    return { handled: true as const, ...result };
  }

  if (input.eventType === "call.answered" && clientState.awaiting === "transfer") {
    const result = await handleTransferResult({
      sessionId: clientState.sessionId,
      answered: true,
    });
    return { handled: true as const, ...result };
  }

  if (
    input.eventType === "call.hangup" &&
    clientState.awaiting === "transfer"
  ) {
    const result = await handleTransferResult({
      sessionId: clientState.sessionId,
      answered: false,
    });
    return { handled: true as const, ...result };
  }

  if (input.eventType === "call.recording.saved") {
    const url = String(
      (input.eventPayload.recording_urls as { mp3?: string })?.mp3 ??
        input.eventPayload.recording_url ??
        "",
    );
    if (url) {
      const prisma = getPrisma();
      await prisma.smartRoutingCallSession.update({
        where: { id: clientState.sessionId },
        data: { recordingUrl: url, finalOutcome: "voicemail", completedAt: new Date() },
      });
      await emitSmartRoutingEvent({
        workspaceId: session.workspaceId,
        type: "VOICEMAIL_RECEIVED",
        sessionId: clientState.sessionId,
        payload: { url },
      });
    }
    return { handled: true as const, kind: "recording" };
  }

  if (input.eventType === "call.hangup") {
    const prisma = getPrisma();
    await prisma.smartRoutingCallSession.updateMany({
      where: { id: clientState.sessionId, completedAt: null },
      data: { completedAt: new Date(), finalOutcome: "caller_hung_up" },
    });
    return { handled: true as const, kind: "hangup" };
  }

  return { handled: false as const };
}

export async function getCallTimeline(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: {
      nodeExecutions: { orderBy: { startedAt: "asc" } },
      commandReceipts: { orderBy: { createdAt: "asc" } },
      flow: true,
    },
  });
  if (!session) return null;

  const events: Array<{
    at: string;
    label: string;
    detail?: string;
    kind: string;
  }> = [
    {
      at: session.startedAt.toISOString(),
      label: "Incoming call received",
      kind: "call_received",
    },
  ];

  for (const ex of session.nodeExecutions) {
    events.push({
      at: ex.startedAt.toISOString(),
      label: `${ex.nodeType} executed`,
      detail: ex.nodeId,
      kind: ex.nodeType.toLowerCase(),
    });
    if (ex.completedAt) {
      const result = ex.resultJson as Record<string, unknown> | null;
      if (result?.transferTo) {
        events.push({
          at: ex.completedAt.toISOString(),
          label: `Transfer to ${result.transferTo}`,
          kind: "transfer",
        });
      }
      if (result?.whisperTo) {
        events.push({
          at: ex.completedAt.toISOString(),
          label: `Whisper ring to ${result.whisperTo}`,
          kind: "whisper",
        });
      }
    }
  }

  if (session.menuSelection) {
    events.push({
      at: session.startedAt.toISOString(),
      label: `Caller pressed ${session.menuSelection}`,
      kind: "menu",
    });
  }
  if (session.smsTriggered) {
    events.push({
      at: session.completedAt?.toISOString() ?? new Date().toISOString(),
      label: "Text Back workflow triggered",
      kind: "sms",
    });
  }
  if (session.finalOutcome) {
    events.push({
      at: session.completedAt?.toISOString() ?? new Date().toISOString(),
      label: `Call ended — ${session.finalOutcome.replace(/_/g, " ")}`,
      kind: "outcome",
    });
  }

  return { session, timeline: events };
}

export async function listFlowActivity(workspaceId: string, flowId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.smartRoutingCallSession.findMany({
    where: { workspaceId, flowId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
