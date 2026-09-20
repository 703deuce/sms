import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";
import { loadVoiceV3NotificationsConfigForCall } from "@/lib/voice-v3/notifications/load-config-for-call";
import { notifyVoiceV3TransferOutcome } from "@/lib/voice-v3/notifications/notify-transfer-outcome";
import type { TransferAttemptLine } from "@/lib/voice-v3/notifications/format-transfer-notification";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function outcomeLabel(outcome: string): string {
  const o = outcome.toUpperCase();
  if (o === "CONNECTED") return "connected";
  if (o === "NO_ANSWER") return "no answer";
  if (o === "TIMEOUT") return "no answer";
  if (o === "DECLINED") return "declined";
  if (o === "VOICEMAIL") return "voicemail";
  if (o.startsWith("SKIPPED")) {
    if (o.includes("OUTSIDE")) return "off schedule";
    if (o.includes("TEMPORARILY")) return "temporarily unavailable";
    return "skipped";
  }
  return "unavailable";
}

export async function recordVoiceV3TransferOutcomeForPython(input: {
  workspaceId: string;
  callId: string;
  agentId?: string | null;
  transferRequestId: string;
  routeId: string;
  status: "transfer_connected" | "transfer_exhausted" | "transfer_no_eligible_destinations";
  reason?: string | null;
  attempts: Array<{
    destination_id: string;
    mode?: string;
    outcome: string;
    attempt_index?: number;
  }>;
  connectedDestinationId?: string | null;
}): Promise<{ ok: true }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      id: true,
      metadata: true,
      fromE164: true,
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  if (!call) {
    return { ok: true };
  }

  const meta = asRecord(call.metadata);
  const voiceV3 = asRecord(meta.voiceV3);
  voiceV3.lastTransfer = {
    transferRequestId: input.transferRequestId,
    routeId: input.routeId,
    status: input.status,
    attempts: input.attempts,
    at: new Date().toISOString(),
  };
  meta.voiceV3 = voiceV3;

  const transferred = input.status === "transfer_connected";
  const outcome =
    input.status === "transfer_exhausted"
      ? "transfer_exhausted"
      : input.status === "transfer_no_eligible_destinations"
        ? "transfer_no_eligible_destinations"
        : transferred
          ? "transferred"
          : null;
  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: meta as object,
      transferred,
      ...(outcome ? { outcome } : {}),
    },
  });

  await prisma.voiceTransfer.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      transferType: "voice_v3_livekit",
      destination: input.connectedDestinationId || input.routeId,
      status: transferred ? "completed" : "failed",
      summary: input.reason,
      answered: transferred,
      completedAt: new Date(),
      metadata: {
        transferRequestId: input.transferRequestId,
        routeId: input.routeId,
        attempts: input.attempts,
        status: input.status,
      } as object,
    },
  }).catch(() => undefined);

  await appendTraceEvent(call.id, {
    kind: input.status,
    detail: {
      transferRequestId: input.transferRequestId,
      routeId: input.routeId,
      attempts: input.attempts,
    },
  }).catch(() => undefined);

  void (async () => {
    try {
      const loaded = await loadVoiceV3NotificationsConfigForCall(call.id);
      if (!loaded) return;
      const destMap = new Map(
        (loaded.config.transfer?.destinations || []).map((d) => [d.id, d.label]),
      );
      const route = loaded.config.transfer?.routes?.find((r) => r.id === input.routeId);
      const attemptLines: TransferAttemptLine[] = input.attempts.map((a) => ({
        label: destMap.get(a.destination_id) || "On-call",
        outcome: outcomeLabel(a.outcome),
      }));
      const callerName = call.contact
        ? [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")
        : null;
      await notifyVoiceV3TransferOutcome({
        config: loaded.config,
        workspaceId: input.workspaceId,
        callId: call.id,
        transferRequestId: input.transferRequestId,
        routeId: input.routeId,
        routeLabel: route?.label,
        callerName,
        callerPhone: call.fromE164,
        reason: input.reason,
        connectedDestinationLabel:
          input.connectedDestinationId
            ? destMap.get(input.connectedDestinationId) || null
            : null,
        attempts: attemptLines,
        status: input.status,
      });
    } catch (err) {
      console.error("VOICE_V3_TRANSFER_NOTIFICATION_HOOK_FAILED", {
        callId: call.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  return { ok: true };
}
