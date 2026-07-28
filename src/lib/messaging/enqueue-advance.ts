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

  if (input.idempotencyKey) {
    const existing = await prisma.jobQueue.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && (existing.status === "pending" || existing.status === "deferred" || existing.status === "processing")) {
      return existing;
    }
    if (existing) {
      return prisma.jobQueue.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          payload: input.payload,
          runAfter: input.runAfter ?? new Date(),
          attempts: 0,
          lastError: null,
          completedAt: null,
          lockedAt: null,
          workspaceId: input.workspaceId,
          queueName: input.queueName ?? "default",
          jobType: input.jobType,
        },
      });
    }
  }

  return prisma.jobQueue.create({
    data: {
      jobType: input.jobType,
      queueName: input.queueName ?? "default",
      workspaceId: input.workspaceId,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 8,
    },
  });
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
