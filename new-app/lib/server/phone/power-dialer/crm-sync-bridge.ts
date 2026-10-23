import { getPrisma } from "@/lib/server/db";
import {
  publishCallCompleted,
  publishCallbackScheduled,
} from "@/lib/crm/events";
import { CRM_PROVIDER_IDS } from "@/lib/crm/registry";
import { emitTypedEvent } from "@/lib/crm/runtime/event-bus";

export async function syncPowerDialerAttemptToIntegrations(input: {
  workspaceId: string;
  attemptId: string;
  contactId: string;
  humanCallId?: string | null;
  disposition: string;
  notes?: string;
  callbackAt?: Date | null;
  triggerCrm: boolean;
}) {
  if (!input.triggerCrm) return { skipped: true, reason: "crm_flag_off" };

  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true },
  });
  if (!attempt) return { skipped: true, reason: "attempt_missing" };

  const call = attempt.humanCall || (input.humanCallId
    ? await prisma.humanCall.findFirst({ where: { id: input.humanCallId, workspaceId: input.workspaceId } })
    : null);

  const connected = await prisma.integrationConnection.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });

  if (!connected.length) {
    await logPdSync({
      workspaceId: input.workspaceId,
      provider: "none",
      operation: "disposition_writeback",
      attemptId: input.attemptId,
      contactId: input.contactId,
      humanCallId: call?.id,
      idempotencyKey: `pd-crm:${input.attemptId}:no_provider`,
      status: "skipped",
      errorMessage: "No CRM connected",
    });
    return { skipped: true, reason: "no_crm" };
  }

  const durationSec = call?.answeredAt && call?.endedAt
    ? Math.max(0, Math.floor((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000))
    : attempt.billableSeconds ?? null;

  if (call?.id) {
    const idem = `pd-crm:${input.attemptId}:call_completed`;
    const existing = await prisma.powerDialerIntegrationSyncLog.findUnique({
      where: { idempotencyKey: idem },
    });
    if (!existing) {
      await logPdSync({
        workspaceId: input.workspaceId,
        provider: "bus",
        operation: "log_call",
        attemptId: input.attemptId,
        contactId: input.contactId,
        humanCallId: call.id,
        idempotencyKey: idem,
        status: "pending",
      });
      await publishCallCompleted({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        callId: call.id,
        direction: "outbound",
        from: call.from,
        to: call.to,
        durationSeconds: durationSec,
        disposition: input.disposition,
        recordingUrl: call.recordingUrl,
        notes: input.notes,
      });
      await markPdSync(idem, "succeeded");
    }
  }

  if (input.callbackAt) {
    const idem = `pd-crm:${input.attemptId}:callback`;
    const existing = await prisma.powerDialerIntegrationSyncLog.findUnique({
      where: { idempotencyKey: idem },
    });
    if (!existing) {
      await logPdSync({
        workspaceId: input.workspaceId,
        provider: "bus",
        operation: "create_callback_task",
        attemptId: input.attemptId,
        contactId: input.contactId,
        humanCallId: call?.id,
        idempotencyKey: idem,
        status: "pending",
      });
      await publishCallbackScheduled({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        callId: call?.id,
        phone: call?.to,
      });
      await emitTypedEvent("task.created", {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        eventId: `pd-task-${input.attemptId}`,
        payload: {
          subject: `Power dialer callback: ${input.disposition}`,
          notes: input.notes,
          dueAt: input.callbackAt.toISOString(),
          source: "power_dialer",
        },
      });
      await markPdSync(idem, "succeeded");
    }
  }

  return { ok: true, providers: connected.map((c) => c.provider) };
}

async function logPdSync(input: {
  workspaceId: string;
  provider: string;
  operation: string;
  attemptId?: string;
  contactId?: string;
  humanCallId?: string | null;
  idempotencyKey: string;
  status: string;
  errorMessage?: string;
}) {
  const prisma = getPrisma();
  await prisma.powerDialerIntegrationSyncLog.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      operation: input.operation,
      attemptId: input.attemptId,
      contactId: input.contactId,
      humanCallId: input.humanCallId || undefined,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      errorMessage: input.errorMessage,
      finishedAt: input.status === "succeeded" ? new Date() : undefined,
    },
    update: {
      status: input.status,
      errorMessage: input.errorMessage,
      finishedAt: input.status === "succeeded" || input.status === "failed" ? new Date() : undefined,
    },
  });
}

async function markPdSync(idempotencyKey: string, status: "succeeded" | "failed", error?: string) {
  const prisma = getPrisma();
  await prisma.powerDialerIntegrationSyncLog.update({
    where: { idempotencyKey },
    data: { status, errorMessage: error, finishedAt: new Date() },
  });
}

export async function listPowerDialerIntegrationSyncHistory(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.powerDialerIntegrationSyncLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}
