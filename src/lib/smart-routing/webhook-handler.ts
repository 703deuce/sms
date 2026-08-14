import "server-only";

import { decodeClientState } from "./telnyx-provider";
import { handleGatherResult, handleTransferResult } from "./flow-runtime";
import { loadCallSession } from "./session-store";
import { resolveActiveFlowForNumber } from "./flow-service";
import { getPrisma } from "@/lib/db";

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

export async function processSmartRoutingWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}) {
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
        data: { recordingUrl: url, finalOutcome: "voicemail" },
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
      flow: true,
    },
  });
  if (!session) return null;
  return session;
}

export async function listFlowActivity(workspaceId: string, flowId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.smartRoutingCallSession.findMany({
    where: { workspaceId, flowId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
