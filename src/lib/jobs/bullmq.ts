import { DelayedError, Queue, UnrecoverableError, Worker } from "bullmq";
import IORedis from "ioredis";
import { handleJob } from "./job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";

let sharedConnection: IORedis | null = null;
const queueCache = new Map<string, Queue>();

/** Stored on job data so DB outbox can be completed after sanitize. */
const IDEMPOTENCY_FIELD = "__idempotencyKey";

/**
 * BullMQ rejects custom job ids that contain `:`.
 * Idempotency keys often embed ISO timestamps (`2026-08-01T22:12`).
 */
export function toBullmqJobId(id: string): string {
  return id.replace(/:/g, "_");
}

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL required for BullMQ");
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}

function getQueue(queueName: string) {
  let queue = queueCache.get(queueName);
  if (!queue) {
    queue = new Queue(queueName, { connection: connection() });
    queueCache.set(queueName, queue);
  }
  return queue;
}

async function syncDbJob(idempotencyKey: string | undefined, outcome: "completed" | "failed", error?: string) {
  if (!idempotencyKey) return;
  const job = await getPrisma().jobQueue.findUnique({ where: { idempotencyKey } });
  if (!job) return;
  if (outcome === "completed") await completeJob(job.id);
  else await failJob(job.id, error || "failed", undefined, undefined, true);
}

export async function startBullmqWorkers() {
  const conn = connection();

  const queues = [
    "default",
    "maintenance",
    "review-campaign",
    "sms-send",
    "email-send",
    "review-import",
    "automations",
    "voice-calls",
    // CRM provider-isolated queues (+ legacy "integrations")
    "integrations",
    "crm-salesforce",
    "crm-zoho",
    "crm-pipedrive",
    // External native integration queues
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
  ] as const;

  for (const name of queues) {
    void getQueue(name);

    const isCrm = name.startsWith("crm-") || name === "integrations";
    void new Worker(
      name,
      async (job) => {
        const raw = { ...((job.data || {}) as Record<string, unknown>) };
        const idempotencyKey =
          (typeof raw[IDEMPOTENCY_FIELD] === "string" && raw[IDEMPOTENCY_FIELD]) ||
          job.id ||
          undefined;
        delete raw[IDEMPOTENCY_FIELD];
        try {
          await handleJob(job.name, raw);
          await syncDbJob(idempotencyKey, "completed");
        } catch (err) {
          if (err instanceof JobDeferredError) {
            // Mirror soft defer into DB outbox so cron doesn't promote early forever
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
          if (err instanceof JobFailedError) {
            await syncDbJob(idempotencyKey, "failed", message);
            throw new UnrecoverableError(message);
          }
          throw err;
        }
      },
      {
        connection: conn,
        // Isolate CRM concurrency per provider queue; send queues stay higher.
        concurrency: name.endsWith("send") ? 5 : isCrm ? 3 : 2,
      },
    );
  }
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

  // If a prior run completed/failed under the same jobId, remove it so re-advance works
  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "delayed") {
        // Wake immediately when requested (compliance webhook / refresh), else bump delay.
        // Race-safe: job may leave delayed between getState() and promote().
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
        return;
      } else if (
        state === "waiting" ||
        state === "prioritized" ||
        state === "active" ||
        state === "waiting-children"
      ) {
        return;
      }
    }
  }

  await queue.add(jobName, payload, {
    jobId,
    delay: opts?.delay,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    // Registration polls need many soft retries; send jobs stay modest
    attempts: isRegistration ? 500 : 8,
    backoff: { type: "exponential", delay: 15_000 },
  });
}

/** Push due DB outbox rows into BullMQ (recovers dual-write failures). */
export async function syncDbOutboxToBullmq(limit = 50) {
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

  let synced = 0;
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
      console.warn("[syncDbOutboxToBullmq] failed for", job.id, err);
    }
  }
  return { synced };
}
