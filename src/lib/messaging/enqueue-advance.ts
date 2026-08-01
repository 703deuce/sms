import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";

export type EnqueueJobInput = {
  jobType: string;
  queueName?: string;
  workspaceId?: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
  /** Lower = higher priority (default 50). */
  priority?: number;
  /** Force wake an existing pending/deferred job to runAt. */
  wake?: boolean;
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
    if (
      existing &&
      (existing.status === "pending" || existing.status === "deferred" || existing.status === "processing")
    ) {
      // Wake deferred/pending jobs early (e.g. compliance webhook)
      if (input.wake || runAfter.getTime() < existing.runAfter.getTime()) {
        job = await prisma.jobQueue.update({
          where: { id: existing.id },
          data: {
            status: existing.status === "processing" ? existing.status : "pending",
            runAfter,
            payload: input.payload,
            lastError: null,
            lockedAt: existing.status === "processing" ? existing.lockedAt : null,
            ...(input.priority != null ? { priority: input.priority } : {}),
          },
        });
      } else {
        job = existing;
      }
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
          maxAttempts: input.maxAttempts ?? existing.maxAttempts,
          priority: input.priority ?? existing.priority ?? 50,
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
        priority: input.priority ?? 50,
      },
    });
  }

  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    try {
      const { enqueueBullmq } = await import("@/lib/jobs/bullmq");
      const delay = Math.max(0, runAfter.getTime() - Date.now());
      await enqueueBullmq(queueName, input.jobType, (input.payload || {}) as Record<string, unknown>, {
        jobId: input.idempotencyKey || job.id,
        delay: delay || undefined,
        wake: Boolean(input.wake) || delay === 0,
      });
    } catch (err) {
      console.warn("[enqueueJob] BullMQ dual-write failed; DB queue still holds the job", err);
    }
  } else {
    // Web-container drain: kick soon so CRM/sync/push don't wait on the poll interval.
    try {
      const { scheduleJobDrain } = await import("@/lib/jobs/inprocess-worker");
      scheduleJobDrain();
    } catch {
      // instrumentation may not have loaded yet during early boot — poller will catch up
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
    // Brand/A2P review can take days — soft polls must not die after 8 attempts
    maxAttempts: 500,
    wake: deferMs === 0,
  });
}

/** Reclaim jobs stuck in processing after a worker crash. */
export async function reclaimStuckJobs(staleMs = 10 * 60 * 1000) {
  const cutoff = new Date(Date.now() - staleMs);
  const result = await getPrisma().jobQueue.updateMany({
    where: {
      status: "processing",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "pending",
      lockedAt: null,
      runAfter: new Date(),
      lastError: "reclaimed_stale_processing",
    },
  });
  return result.count;
}

export async function claimDueJobs(limit = 25) {
  const prisma = getPrisma();
  await reclaimStuckJobs();
  const now = new Date();
  const due = await prisma.jobQueue.findMany({
    where: {
      status: { in: ["pending", "deferred"] },
      runAfter: { lte: now },
    },
    orderBy: [{ priority: "asc" }, { runAfter: "asc" }],
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
  const result = await getPrisma().jobQueue.updateMany({
    where: { id: jobId, status: { in: ["processing", "pending", "deferred"] } },
    data: { status: "completed", completedAt: new Date(), lastError: null, lockedAt: null },
  });
  if (result.count === 0) {
    return getPrisma().jobQueue.findUnique({ where: { id: jobId } });
  }
  return getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
}

export async function failJob(
  jobId: string,
  error: string,
  deferMs?: number,
  softDefer?: boolean,
  terminal?: boolean,
) {
  const job = await getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });

  if (terminal) {
    const result = await getPrisma().jobQueue.updateMany({
      where: { id: jobId, status: { in: ["processing", "pending", "deferred"] } },
      data: {
        status: "failed",
        lastError: error,
        lockedAt: null,
        completedAt: new Date(),
      },
    });
    if (result.count === 0) return job;
    return getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
  }

  // Soft defer (Twilio waiting): do not consume attempts toward failure
  if (deferMs && softDefer) {
    const result = await getPrisma().jobQueue.updateMany({
      where: { id: jobId, status: { in: ["processing", "pending", "deferred"] } },
      data: {
        status: "deferred",
        lastError: error,
        runAfter: new Date(Date.now() + deferMs),
        lockedAt: null,
        attempts: Math.max(0, job.attempts - 1),
      },
    });
    if (result.count === 0) return job;
    return getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
  }

  if (deferMs && job.attempts < job.maxAttempts) {
    const result = await getPrisma().jobQueue.updateMany({
      where: { id: jobId, status: { in: ["processing", "pending", "deferred"] } },
      data: {
        status: "deferred",
        lastError: error,
        runAfter: new Date(Date.now() + deferMs),
        lockedAt: null,
      },
    });
    if (result.count === 0) return job;
    return getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
  }
  const result = await getPrisma().jobQueue.updateMany({
    where: { id: jobId, status: { in: ["processing", "pending", "deferred"] } },
    data: {
      status: job.attempts >= job.maxAttempts ? "failed" : "pending",
      lastError: error,
      runAfter: new Date(Date.now() + Math.min(60_000 * Math.max(1, job.attempts), 15 * 60_000)),
      lockedAt: null,
    },
  });
  if (result.count === 0) return job;
  return getPrisma().jobQueue.findUniqueOrThrow({ where: { id: jobId } });
}
