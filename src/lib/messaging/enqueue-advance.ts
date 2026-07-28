import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export type EnqueueJobInput = {
  jobType: string;
  queueName?: string;
  workspaceId?: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
};

export async function enqueueJob(input: EnqueueJobInput) {
  const prisma = getPrisma();
  const runAfter = input.runAfter ?? new Date();
  const queueName = input.queueName ?? "default";

  let job;
  if (input.idempotencyKey) {
    const existing = await prisma.jobQueue.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && (existing.status === "pending" || existing.status === "deferred" || existing.status === "processing")) {
      job = existing;
    } else if (existing) {
      job = await prisma.jobQueue.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          payload: input.payload,
          runAfter,
          attempts: 0,
          lastError: null,
          completedAt: null,
          lockedAt: null,
          workspaceId: input.workspaceId,
          queueName,
          jobType: input.jobType,
        },
      });
    }
  }

  if (!job) {
    job = await prisma.jobQueue.create({
      data: {
        jobType: input.jobType,
        queueName,
        workspaceId: input.workspaceId,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        runAfter,
        maxAttempts: input.maxAttempts ?? 8,
      },
    });
  }

  // Dual-write to BullMQ when configured (DB poll remains the default drain)
  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    try {
      const { enqueueBullmq } = await import("@/lib/jobs/bullmq");
      const delay = Math.max(0, runAfter.getTime() - Date.now());
      await enqueueBullmq(queueName, input.jobType, (input.payload || {}) as Record<string, unknown>, {
        jobId: input.idempotencyKey || job.id,
        delay: delay || undefined,
      });
    } catch (err) {
      console.warn("[enqueueJob] BullMQ dual-write failed; DB queue still holds the job", err);
    }
  }

  return job;
}

export async function enqueueMessagingRegistrationAdvance(workspaceId: string, deferMs = 0) {
  return enqueueJob({
    jobType: "messaging_registration_advance",
    queueName: "review-campaign",
    workspaceId,
    payload: { workspaceId },
    idempotencyKey: `messaging-registration-advance:${workspaceId}`,
    runAfter: deferMs > 0 ? new Date(Date.now() + deferMs) : new Date(),
  });
}

export async function claimDueJobs(limit = 25) {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.jobQueue.findMany({
    where: {
      status: { in: ["pending", "deferred"] },
      runAfter: { lte: now },
    },
    orderBy: { runAfter: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const job of due) {
    const updated = await prisma.jobQueue.updateMany({
      where: {
        id: job.id,
        status: { in: ["pending", "deferred"] },
      },
      data: {
        status: "processing",
        lockedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      claimed.push(await prisma.jobQueue.findUniqueOrThrow({ where: { id: job.id } }));
    }
  }
  return claimed;
}

export async function completeJob(jobId: string) {
  return getPrisma().jobQueue.update({
    where: { id: jobId },
    data: { status: "completed", completedAt: new Date(), lastError: null },
  });
}

export async function failJob(jobId: string, error: string, deferMs?: number) {
  const job = await getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
  if (deferMs && job.attempts < job.maxAttempts) {
    return getPrisma().jobQueue.update({
      where: { id: jobId },
      data: {
        status: "deferred",
        lastError: error,
        runAfter: new Date(Date.now() + deferMs),
        lockedAt: null,
      },
    });
  }
  return getPrisma().jobQueue.update({
    where: { id: jobId },
    data: {
      status: job.attempts >= job.maxAttempts ? "failed" : "pending",
      lastError: error,
      runAfter: new Date(Date.now() + Math.min(60_000 * job.attempts, 15 * 60_000)),
      lockedAt: null,
    },
  });
}
