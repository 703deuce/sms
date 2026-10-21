import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";
import { MCTB_JOB_PROCESS_INBOUND_SMS, MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";

export const MCTB_JOB_RECOVERY_SEND = "phone_mctb_recovery_send";
const RECOVERY_QUEUE = "phone_mctb";
const RECOVERY_PRIORITY = 40;

export async function enqueueMctbRecoverySendJob(input: {
  workspaceId: string;
  missedCallEventId: string;
  runAfter: Date;
}): Promise<void> {
  const prisma = getPrisma();
  const idempotencyKey = `phone-mctb-recovery:${input.missedCallEventId}`;
  await prisma.jobQueue.upsert({
    where: { idempotencyKey },
    create: {
      workspaceId: input.workspaceId,
      jobType: MCTB_JOB_RECOVERY_SEND,
      queueName: RECOVERY_QUEUE,
      priority: RECOVERY_PRIORITY,
      maxAttempts: 8,
      runAfter: input.runAfter,
      idempotencyKey,
      payload: {
        workspaceId: input.workspaceId,
        missedCallEventId: input.missedCallEventId,
      } satisfies Prisma.InputJsonObject,
    },
    update: {
      runAfter: input.runAfter,
      status: "pending",
      attempts: 0,
      lastError: null,
      lockedAt: null,
      completedAt: null,
    },
  });
}

/** Claim due recovery jobs and execute sends (safe for concurrent workers). */
export async function processDueMctbRecoveryJobs(input?: { limit?: number }) {
  const prisma = getPrisma();
  const limit = input?.limit ?? 25;
  const now = new Date();

  const due = await prisma.jobQueue.findMany({
    where: {
      jobType: MCTB_JOB_RECOVERY_SEND,
      status: "pending",
      runAfter: { lte: now },
    },
    orderBy: [{ priority: "asc" }, { runAfter: "asc" }],
    take: limit,
    select: { id: true, workspaceId: true, payload: true, idempotencyKey: true },
  });

  const { processDueMctbRecoverySends } = await import("@/lib/server/mctb/recovery-scheduler");
  const results: Array<{ jobId: string; ok: boolean; reason?: string }> = [];

  for (const job of due) {
    const claimed = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: "pending", lockedAt: null },
      data: { status: "processing", lockedAt: now },
    });
    if (claimed.count === 0) continue;

    const payload = job.payload as { workspaceId?: string; missedCallEventId?: string };
    const workspaceId = payload.workspaceId || job.workspaceId;
    const missedCallEventId = payload.missedCallEventId;
    if (!workspaceId || !missedCallEventId) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "failed",
          lastError: "invalid_payload",
          lockedAt: null,
          completedAt: new Date(),
        },
      });
      continue;
    }

    try {
      const batch = await processDueMctbRecoverySends({ workspaceId, limit: 5 });
      const match = batch.results.find((r) => r.missedCallEventId === missedCallEventId);
      const ok = match?.ok ?? batch.results.some((r) => r.ok);
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: ok ? "completed" : "failed",
          completedAt: new Date(),
          lockedAt: null,
          lastError: ok ? null : match?.reason || "send_failed",
        },
      });
      results.push({ jobId: job.id, ok, reason: match?.reason });
    } catch (err) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: "pending",
          lockedAt: null,
          attempts: { increment: 1 },
          lastError: err instanceof Error ? err.message : String(err),
          runAfter: new Date(Date.now() + 60_000),
        },
      });
      results.push({ jobId: job.id, ok: false, reason: "exception" });
    }
  }

  // Also sweep any SCHEDULED rows without jobs (backfill / legacy path).
  const sweep = await processDueMctbRecoverySends({ limit });
  return { jobs: results, sweep };
}

export async function scheduleMctbInboundProcessing(input: {
  idempotencyKey: string;
  workspaceId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Durable row already created in acceptMctbInboundSmsIngress — optional BullMQ wake lives in monolith worker.
  void input;
}
