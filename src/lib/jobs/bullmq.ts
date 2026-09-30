import { DelayedError, Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { handleJob } from "./job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";

let sharedConnection: IORedis | null = null;
const queueCache = new Map<string, Queue>();
const workerCache = new Map<string, Worker>();

/** Campaign / transactional SMS queues on the dedicated dispatch worker. */
export const SMS_DISPATCH_BULLMQ_QUEUES = [
  "review-campaign",
  "sms-send",
  "email-send",
] as const;

/** Interactive MCTB + missed-call opener jobs (same `npm run worker:sms` process). */
export const MCTB_DISPATCH_BULLMQ_QUEUES = ["mctb", "automations"] as const;

/** Voice durable operations + Telnyx async jobs (same dispatch worker as MCTB in production). */
export const VOICE_DISPATCH_BULLMQ_QUEUES = ["voice-calls"] as const;

/** All BullMQ queues started by `startSmsDispatchBullmqWorkers()` in production. */
export const PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES = [
  ...SMS_DISPATCH_BULLMQ_QUEUES,
  ...MCTB_DISPATCH_BULLMQ_QUEUES,
  ...VOICE_DISPATCH_BULLMQ_QUEUES,
] as const;

export type SmsDispatchBullmqQueue = (typeof SMS_DISPATCH_BULLMQ_QUEUES)[number];
export type MctbDispatchBullmqQueue = (typeof MCTB_DISPATCH_BULLMQ_QUEUES)[number];

/** Stored on job data so DB outbox can be completed after sanitize. */
const IDEMPOTENCY_FIELD = "__idempotencyKey";

type BullmqJobMetrics = {
  received: number;
  completed: number;
  failed: number;
  lastReceivedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
};

const smsDispatchMetrics: BullmqJobMetrics = {
  received: 0,
  completed: 0,
  failed: 0,
  lastReceivedAt: null,
  lastCompletedAt: null,
  lastFailedAt: null,
  lastError: null,
};

const mctbDispatchMetrics: BullmqJobMetrics = {
  received: 0,
  completed: 0,
  failed: 0,
  lastReceivedAt: null,
  lastCompletedAt: null,
  lastFailedAt: null,
  lastError: null,
};

const voiceDispatchMetrics: BullmqJobMetrics = {
  received: 0,
  completed: 0,
  failed: 0,
  lastReceivedAt: null,
  lastCompletedAt: null,
  lastFailedAt: null,
  lastError: null,
};

let smsDispatchWorkersReady = false;
let smsDispatchWorkersReadyAt: string | null = null;

/**
 * BullMQ rejects custom job ids that contain `:`.
 * Idempotency keys often embed ISO timestamps (`2026-08-01T22:12`).
 */
export function toBullmqJobId(id: string): string {
  return id.replace(/:/g, "_");
}

function logBullmq(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...fields }));
}

/** Upstash/BullMQ require the Redis protocol URL — not REST. */
export function assertBullmqRedisUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("REDIS_URL is empty");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "REDIS_URL must be a Redis protocol URL (rediss:// or redis://), not an HTTP REST URL. " +
        "In Upstash: copy the Redis TCP/TLS connection string.",
    );
  }
  if (trimmed.includes("UPSTASH_REDIS_REST_URL") || trimmed.includes("rest.upstash.io")) {
    throw new Error(
      "REDIS_URL appears to be an Upstash REST endpoint. BullMQ requires rediss:// TCP/TLS.",
    );
  }
  if (!/^rediss?:\/\//i.test(trimmed)) {
    throw new Error(
      `REDIS_URL must start with redis:// or rediss:// (got ${trimmed.slice(0, 32)}...)`,
    );
  }
}

export function getBullmqRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL required for BullMQ");
  assertBullmqRedisUrl(url);
  return url;
}

function connection() {
  const url = getBullmqRedisUrl();
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(200 + times * 300, 5_000);
        if (times === 1 || times % 10 === 0) {
          logBullmq("bullmq_redis_reconnecting", { attempt: times, delayMs: delay });
        }
        return delay;
      },
    });
    sharedConnection.on("connect", () => {
      logBullmq("bullmq_redis_connect", {});
    });
    sharedConnection.on("ready", () => {
      logBullmq("bullmq_redis_ready", {});
    });
    sharedConnection.on("close", () => {
      logBullmq("bullmq_redis_connection_closed", {});
    });
  }
  return sharedConnection;
}

/** Verify Redis is reachable before reporting worker_started. */
export async function verifyBullmqConnection(timeoutMs = 10_000): Promise<void> {
  const conn = connection();
  await Promise.race([
    conn.ping(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Redis ping timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
  logBullmq("bullmq_connected", { redisUrlScheme: getBullmqRedisUrl().split("://")[0] });
}

function getQueue(queueName: string) {
  let queue = queueCache.get(queueName);
  if (!queue) {
    queue = new Queue(queueName, { connection: connection() });
    queueCache.set(queueName, queue);
  }
  return queue;
}

async function syncDbJob(
  idempotencyKey: string | undefined,
  outcome: "completed" | "failed",
  error?: string,
) {
  if (!idempotencyKey) return;
  const job = await getPrisma().jobQueue.findUnique({ where: { idempotencyKey } });
  if (!job) return;
  if (outcome === "completed") await completeJob(job.id);
  else await failJob(job.id, error || "failed", undefined, undefined, true);
}

function createWorkerProcessor(queueName: string) {
  return async (job: Job) => {
    const raw = { ...((job.data || {}) as Record<string, unknown>) };
    const idempotencyKey =
      (typeof raw[IDEMPOTENCY_FIELD] === "string" && raw[IDEMPOTENCY_FIELD]) ||
      job.id ||
      undefined;
    delete raw[IDEMPOTENCY_FIELD];

    logBullmq("bullmq_job_received", {
      queueName,
      bullmqJobId: job.id,
      jobType: job.name,
      idempotencyKey,
      attempt: job.attemptsMade + 1,
    });

    if (SMS_DISPATCH_BULLMQ_QUEUES.includes(queueName as SmsDispatchBullmqQueue)) {
      smsDispatchMetrics.received += 1;
      smsDispatchMetrics.lastReceivedAt = new Date().toISOString();
    }
    if (MCTB_DISPATCH_BULLMQ_QUEUES.includes(queueName as MctbDispatchBullmqQueue)) {
      mctbDispatchMetrics.received += 1;
      mctbDispatchMetrics.lastReceivedAt = new Date().toISOString();
    }
    if (VOICE_DISPATCH_BULLMQ_QUEUES.includes(queueName as (typeof VOICE_DISPATCH_BULLMQ_QUEUES)[number])) {
      voiceDispatchMetrics.received += 1;
      voiceDispatchMetrics.lastReceivedAt = new Date().toISOString();
    }

    try {
      if (job.name === "send_campaign_sms" || job.name === "send_campaign_email") {
        logBullmq("bullmq_send_started", {
          queueName,
          bullmqJobId: job.id,
          messageId: raw.messageId,
          jobType: job.name,
        });
      }

      await handleJob(job.name, raw);
      await syncDbJob(idempotencyKey, "completed");

      if (job.name === "send_campaign_sms" || job.name === "send_campaign_email") {
        logBullmq("bullmq_send_completed", {
          queueName,
          bullmqJobId: job.id,
          messageId: raw.messageId,
          jobType: job.name,
        });
      }

      if (SMS_DISPATCH_BULLMQ_QUEUES.includes(queueName as SmsDispatchBullmqQueue)) {
        smsDispatchMetrics.completed += 1;
        smsDispatchMetrics.lastCompletedAt = new Date().toISOString();
      }
      if (MCTB_DISPATCH_BULLMQ_QUEUES.includes(queueName as MctbDispatchBullmqQueue)) {
        mctbDispatchMetrics.completed += 1;
        mctbDispatchMetrics.lastCompletedAt = new Date().toISOString();
      }
      if (VOICE_DISPATCH_BULLMQ_QUEUES.includes(queueName as (typeof VOICE_DISPATCH_BULLMQ_QUEUES)[number])) {
        voiceDispatchMetrics.completed += 1;
        voiceDispatchMetrics.lastCompletedAt = new Date().toISOString();
      }

      logBullmq("bullmq_job_completed", {
        queueName,
        bullmqJobId: job.id,
        jobType: job.name,
        idempotencyKey,
      });
    } catch (err) {
      if (err instanceof JobDeferredError) {
        if (idempotencyKey) {
          const row = await getPrisma().jobQueue.findUnique({
            where: { idempotencyKey },
          });
          if (row) {
            await failJob(row.id, err.message, err.deferMs, err.soft);
          }
        }
        await job.moveToDelayed(Date.now() + err.deferMs, job.token);
        throw new DelayedError();
      }

      const message = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code)
          : undefined;

      logBullmq("bullmq_job_failed", {
        queueName,
        bullmqJobId: job.id,
        jobType: job.name,
        idempotencyKey,
        error: message,
        code,
        attempt: job.attemptsMade + 1,
      });

      if (SMS_DISPATCH_BULLMQ_QUEUES.includes(queueName as SmsDispatchBullmqQueue)) {
        smsDispatchMetrics.failed += 1;
        smsDispatchMetrics.lastFailedAt = new Date().toISOString();
        smsDispatchMetrics.lastError = message;
      }
      if (MCTB_DISPATCH_BULLMQ_QUEUES.includes(queueName as MctbDispatchBullmqQueue)) {
        mctbDispatchMetrics.failed += 1;
        mctbDispatchMetrics.lastFailedAt = new Date().toISOString();
        mctbDispatchMetrics.lastError = message;
      }
      if (VOICE_DISPATCH_BULLMQ_QUEUES.includes(queueName as (typeof VOICE_DISPATCH_BULLMQ_QUEUES)[number])) {
        voiceDispatchMetrics.failed += 1;
        voiceDispatchMetrics.lastFailedAt = new Date().toISOString();
        voiceDispatchMetrics.lastError = message;
      }

      if (err instanceof JobFailedError) {
        await syncDbJob(idempotencyKey, "failed", message);
        throw new UnrecoverableError(message);
      }
      throw err;
    }
  };
}

const readyQueues = new Set<string>();

function markQueueReady(queueName: string) {
  readyQueues.add(queueName);
  if (
    PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES.every((q) => readyQueues.has(q)) &&
    !smsDispatchWorkersReady
  ) {
    smsDispatchWorkersReady = true;
    smsDispatchWorkersReadyAt = new Date().toISOString();
    logBullmq("bullmq_dispatch_workers_ready", {
      queues: [...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES],
    });
  }
}

function attachWorkerLifecycleLogs(worker: Worker, queueName: string) {
  const onReady = () => {
    logBullmq("bullmq_worker_ready", { queueName });
    if (
      (PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES as readonly string[]).includes(queueName)
    ) {
      markQueueReady(queueName);
    }
  };
  worker.on("ready", onReady);
  // BullMQ may emit `ready` before the listener is attached on fast reconnects.
  if (worker.isRunning()) {
    onReady();
  }
  worker.on("error", (err) => {
    logBullmq("bullmq_worker_error", {
      queueName,
      error: err instanceof Error ? err.message : String(err),
    });
  });
  worker.on("failed", (job, err) => {
    if (!job) return;
    logBullmq("bullmq_worker_job_failed_event", {
      queueName,
      bullmqJobId: job.id,
      jobType: job.name,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function startWorkersForQueues(queues: readonly string[]) {
  const conn = connection();
  for (const name of queues) {
    if (workerCache.has(name)) continue;
    void getQueue(name);
    const worker = new Worker(name, createWorkerProcessor(name), {
      connection: conn,
      concurrency: name.endsWith("send") ? 5 : 2,
    });
    attachWorkerLifecycleLogs(worker, name);
    workerCache.set(name, worker);
  }
}

/**
 * Start BullMQ consumers for the dedicated SMS dispatch worker container.
 * Must be called from `npm run worker:sms` when QUEUE_DRIVER=bullmq.
 */
export async function startSmsDispatchBullmqWorkers(): Promise<void> {
  await verifyBullmqConnection();
  startWorkersForQueues(PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES);

  const deadline = Date.now() + Number(process.env.SMS_BULLMQ_READY_TIMEOUT_MS || 15_000);
  while (!smsDispatchWorkersReady && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!smsDispatchWorkersReady) {
    const missing = PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES.filter((q) => !readyQueues.has(q));
    throw new Error(
      `BullMQ dispatch workers did not become ready within timeout — missing ready: ${missing.join(", ") || "unknown"} (ready: ${[...readyQueues].join(", ")})`,
    );
  }
}

export function getSmsDispatchBullmqStatus() {
  return {
    ready: smsDispatchWorkersReady,
    readyAt: smsDispatchWorkersReadyAt,
    queues: [...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES],
    smsQueues: [...SMS_DISPATCH_BULLMQ_QUEUES],
    mctbQueues: [...MCTB_DISPATCH_BULLMQ_QUEUES],
    voiceQueues: [...VOICE_DISPATCH_BULLMQ_QUEUES],
    metrics: { ...smsDispatchMetrics },
    mctbMetrics: { ...mctbDispatchMetrics },
    voiceMetrics: { ...voiceDispatchMetrics },
  };
}

export function getMctbDispatchBullmqStatus() {
  return {
    ready: smsDispatchWorkersReady,
    readyAt: smsDispatchWorkersReadyAt,
    queues: [...MCTB_DISPATCH_BULLMQ_QUEUES],
    metrics: { ...mctbDispatchMetrics },
  };
}

export function useBullmqQueueDriver(): boolean {
  return process.env.QUEUE_DRIVER === "bullmq" && Boolean(process.env.REDIS_URL?.trim());
}

/** Wake a durable job_queue row on BullMQ immediately after DB commit (DB remains source of truth). */
export async function wakeDurableJobQueueRowToBullmq(input: {
  queueName: string;
  jobType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAfter?: Date;
}) {
  if (!useBullmqQueueDriver()) {
    return { mode: "db" as const, enqueued: false };
  }
  const runAfter = input.runAfter ?? new Date();
  const delay = Math.max(0, runAfter.getTime() - Date.now());
  try {
    await enqueueBullmq(input.queueName, input.jobType, input.payload, {
      jobId: input.idempotencyKey,
      delay: delay || undefined,
      wake: delay === 0,
    });
    return { mode: "bullmq" as const, enqueued: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      JSON.stringify({
        event: "bullmq_wake_failed",
        queueName: input.queueName,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        error: message,
      }),
    );
    return { mode: "bullmq" as const, enqueued: false, error: message };
  }
}

export function resetSmsDispatchBullmqMetricsForTests() {
  smsDispatchMetrics.received = 0;
  smsDispatchMetrics.completed = 0;
  smsDispatchMetrics.failed = 0;
  smsDispatchMetrics.lastReceivedAt = null;
  smsDispatchMetrics.lastCompletedAt = null;
  smsDispatchMetrics.lastFailedAt = null;
  smsDispatchMetrics.lastError = null;
  mctbDispatchMetrics.received = 0;
  mctbDispatchMetrics.completed = 0;
  mctbDispatchMetrics.failed = 0;
  mctbDispatchMetrics.lastReceivedAt = null;
  mctbDispatchMetrics.lastCompletedAt = null;
  mctbDispatchMetrics.lastFailedAt = null;
  mctbDispatchMetrics.lastError = null;
  voiceDispatchMetrics.received = 0;
  voiceDispatchMetrics.completed = 0;
  voiceDispatchMetrics.failed = 0;
  voiceDispatchMetrics.lastReceivedAt = null;
  voiceDispatchMetrics.lastCompletedAt = null;
  voiceDispatchMetrics.lastFailedAt = null;
  voiceDispatchMetrics.lastError = null;
  smsDispatchWorkersReady = false;
  smsDispatchWorkersReadyAt = null;
  readyQueues.clear();
}

/** Graceful shutdown for embedded worker:all (Coolify deploy SIGTERM). */
export async function closeBullmqWorkers(): Promise<void> {
  const workers = [...workerCache.values()];
  workerCache.clear();
  for (const worker of workers) {
    try {
      await worker.close();
    } catch (err) {
      logBullmq("bullmq_worker_close_error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  readyQueues.clear();
  smsDispatchWorkersReady = false;
  smsDispatchWorkersReadyAt = null;

  const queues = [...queueCache.values()];
  queueCache.clear();
  for (const queue of queues) {
    try {
      await queue.close();
    } catch {
      // ignore close races during shutdown
    }
  }

  if (sharedConnection) {
    try {
      await sharedConnection.quit();
    } catch {
      try {
        sharedConnection.disconnect();
      } catch {
        // ignore
      }
    }
    sharedConnection = null;
  }
  logBullmq("bullmq_workers_closed", {});
}

export async function startBullmqWorkers() {
  const conn = connection();

  const queues = [
    "default",
    "maintenance",
    ...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES,
    "review-import",
    "integrations",
    "crm-salesforce",
    "crm-zoho",
    "crm-pipedrive",
    "ext-calendly",
    "ext-activecampaign",
    "ext-mailchimp",
    "ext-highlevel",
    "ext-woocommerce",
    "ext-typeform",
    "ext-jotform",
    "ext-close",
    "ext-freshdesk",
    "ext-klaviyo",
    /** Legacy provider id "internal" — appointment/automation events must not strand on ext-internal. */
    "ext-internal",
    "voice-outbound",
  ] as const;

  startWorkersForQueues(queues);
  void conn;
}

export async function enqueueBullmq(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number; wake?: boolean },
) {
  const queue = getQueue(queueName);
  const isRegistration = jobName === "messaging_registration_advance";
  const rawJobId = opts?.jobId;
  const jobId = rawJobId ? toBullmqJobId(rawJobId) : undefined;
  const payload = rawJobId ? { ...data, [IDEMPOTENCY_FIELD]: rawJobId } : data;

  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "delayed") {
        try {
          if (opts?.wake || !opts?.delay) {
            await existing.promote();
          } else {
            await existing.changeDelay(opts.delay);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/not in the delayed state/i.test(msg)) throw err;
        }
        logBullmq("bullmq_job_already_queued", {
          queueName,
          bullmqJobId: jobId,
          jobType: jobName,
          state,
          action: "promoted_or_delayed",
        });
        return;
      } else if (
        state === "waiting" ||
        state === "prioritized" ||
        state === "active" ||
        state === "waiting-children"
      ) {
        logBullmq("bullmq_job_already_queued", {
          queueName,
          bullmqJobId: jobId,
          jobType: jobName,
          state,
          action: "skipped_duplicate",
        });
        return;
      }
    }
  }

  const added = await queue.add(jobName, payload, {
    jobId,
    delay: opts?.delay,
    removeOnComplete: Math.max(100, Number(process.env.BULLMQ_REMOVE_ON_COMPLETE || 1000)),
    removeOnFail: Math.max(100, Number(process.env.BULLMQ_REMOVE_ON_FAIL || 5000)),
    attempts: isRegistration ? 500 : 8,
    backoff: { type: "exponential", delay: 15_000 },
  });

  logBullmq("bullmq_job_enqueued", {
    queueName,
    bullmqJobId: added.id,
    jobType: jobName,
    idempotencyKey: rawJobId,
    delayMs: opts?.delay ?? 0,
  });
}

/** Push due DB outbox rows into BullMQ (recovers dual-write failures). */
export async function syncDbOutboxToBullmq(limit = 50) {
  const { JOB_PRIORITY_INTERACTIVE_MAX } = await import("@/lib/jobs/job-priority");
  const prisma = getPrisma();
  const now = new Date();
  const interactiveBudget = Math.min(Math.ceil(limit * 0.7), limit);
  const bulkBudget = Math.max(0, limit - interactiveBudget);

  const interactiveDue = await prisma.jobQueue.findMany({
    where: {
      status: { in: ["pending", "deferred"] },
      runAfter: { lte: now },
      priority: { lte: JOB_PRIORITY_INTERACTIVE_MAX },
    },
    orderBy: [{ priority: "asc" }, { runAfter: "asc" }],
    take: interactiveBudget,
  });

  const interactiveIds = interactiveDue.map((j) => j.id);
  const bulkDue =
    bulkBudget > 0
      ? await prisma.jobQueue.findMany({
          where: {
            status: { in: ["pending", "deferred"] },
            runAfter: { lte: now },
            ...(interactiveIds.length ? { id: { notIn: interactiveIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { runAfter: "asc" }],
          take: bulkBudget,
        })
      : [];

  const due = [...interactiveDue, ...bulkDue];

  let synced = 0;
  let skipped = 0;
  for (const job of due) {
    try {
      const delay = Math.max(0, job.runAfter.getTime() - Date.now());
      await enqueueBullmq(
        job.queueName,
        job.jobType,
        (job.payload || {}) as Record<string, unknown>,
        {
          jobId: job.idempotencyKey || job.id,
          delay: delay || undefined,
          wake: delay === 0,
        },
      );
      synced += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already_queued|skipped_duplicate/i.test(message)) {
        skipped += 1;
        continue;
      }
      console.warn("[syncDbOutboxToBullmq] failed for", job.id, err);
    }
  }
  return { synced, skipped, examined: due.length };
}
