import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/db/client";
import {
  executeJobType,
  jobTypeToQueue,
  type JobHandlerPayload,
} from "@/lib/queue/job-handlers";
import type { QueueName } from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";
import { releaseUsage } from "@/lib/plans";
import { JobDeferredError } from "@/lib/queue/errors";

export type QueueJobPayload = JobHandlerPayload & {
  jobType?: string;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled", "cancelled"]);

const LEASE_MS = 60_000;
const HEARTBEAT_MS = 20_000;

/**
 * Shared processors for BullMQ workers and Next.js after() kicks.
 * Database cron also routes through this path for leases/heartbeats/billing.
 */
export async function processQueueJob(
  queueName: QueueName,
  payload: QueueJobPayload
): Promise<void> {
  const supabase = createServiceClient();
  const ledgerJobId =
    (typeof payload.ledgerJobId === "string" && payload.ledgerJobId) ||
    (typeof payload.jobId === "string" && payload.jobId) ||
    null;

  let jobType = typeof payload.jobType === "string" ? payload.jobType : "";

  const workerLabel =
    process.env.WORKER_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    `web-${process.pid}`;
  /** Unique per claim — never reuse HOSTNAME alone (concurrency-safe). */
  const leaseOwner = randomUUID();
  let attempts = 0;
  let maxAttempts = 3;
  let claimedOk = !ledgerJobId;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let leaseLost = false;

  try {
    if (ledgerJobId) {
      const claimed = await claimLedgerJob(ledgerJobId, leaseOwner, workerLabel, supabase);
      if (claimed.kind === "skip") {
        logger.info("queue_processor_skip", {
          ledgerJobId,
          status: claimed.status,
          queueName,
        });
        return;
      }
      if (claimed.kind === "not_ready") {
        throw new JobDeferredError("Job not ready yet", claimed.delayMs);
      }
      if (claimed.kind === "busy") {
        throw new JobDeferredError("Job lease held by another worker", 5_000);
      }
      claimedOk = true;
      jobType = jobType || claimed.jobType;
      attempts = claimed.attempts;
      maxAttempts = claimed.maxAttempts;
      heartbeatTimer = setInterval(() => {
        void extendLease(ledgerJobId, leaseOwner).catch((err) => {
          leaseLost = true;
          logger.warn("queue_lease_heartbeat_failed", {
            ledgerJobId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }, HEARTBEAT_MS);
    }

    if (!jobType) {
      jobType = defaultJobTypeForQueue(queueName);
    }

    if (jobTypeToQueue(jobType) !== queueName) {
      logger.warn("queue_processor_queue_mismatch", { queueName, jobType });
    }

    if (!claimedOk) {
      throw new Error("Refusing to execute unclaimed ledger job");
    }

    const result = await executeJobType(jobType, {
      ...payload,
      ledgerJobId: ledgerJobId ?? undefined,
    });

    if (leaseLost || (ledgerJobId && !(await stillOwnsLease(ledgerJobId, leaseOwner)))) {
      logger.warn("queue_processor_lost_lease_after_work", { ledgerJobId, queueName, jobType });
      // Do not flip terminal status or release usage — the reclaiming worker owns that.
      return;
    }

    if (!result.ok) {
      if (ledgerJobId) {
        const exhausted = !result.permanent && attempts >= maxAttempts;
        const terminal = result.permanent || exhausted;
        const delayMs = 5_000;
        await supabase
          .from("job_queue")
          .update({
            status: terminal ? "failed" : "pending",
            lifecycle_status: result.permanent
              ? "permanently_failed"
              : exhausted
                ? "dead_letter"
                : "retrying",
            error_message: result.error ?? "Job failed",
            error_code: result.permanent ? "unrecoverable" : exhausted ? "dead_letter" : "retryable",
            error_class: result.permanent ? "permanent" : exhausted ? "dead_letter" : "retryable",
            customer_error: terminal
              ? "This job failed after multiple retries. An operator can retry it from Admin → Ops."
              : null,
            finished_at: terminal ? new Date().toISOString() : null,
            scheduled_at: terminal ? undefined : new Date(Date.now() + delayMs).toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          })
          .eq("id", ledgerJobId)
          .eq("status", "running")
          .eq("lease_owner", leaseOwner);

        if (terminal) {
          await releaseReservedUsage(payload);
          if (jobType === "early_enrichment") {
            await clearEarlyEnrichmentFlag(payload).catch(() => {});
          }
        } else {
          // Durable ledger retry — BullMQ uses DelayedError (no attempt burn); cron ignores.
          throw new JobDeferredError(result.error ?? "Job failed — retry scheduled", delayMs);
        }
      }
      // Terminal ledger updates already applied — do not burn BullMQ attempts.
      const err = new Error(result.error ?? "Job failed");
      (err as Error & { unrecoverable?: boolean }).unrecoverable = true;
      throw err;
    }

    if (ledgerJobId && result.markComplete === false) {
      const delayMs = 5_000;
      await supabase
        .from("job_queue")
        .update({
          status: "pending",
          lifecycle_status: "queued",
          scheduled_at: new Date(Date.now() + delayMs).toISOString(),
          error_message: "Deferred — another worker holds the lease",
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", ledgerJobId)
        .eq("status", "running")
        .eq("lease_owner", leaseOwner);

      throw new JobDeferredError("Deferred — another worker holds the lease", delayMs);
    }

    if (ledgerJobId && result.markComplete !== false) {
      await markLedgerTerminal(ledgerJobId, "completed", leaseOwner);
      const { rebuildFeatureSummaryAfterJob } = await import("@/lib/platform/summaries");
      await rebuildFeatureSummaryAfterJob({
        jobType,
        organizationId:
          typeof payload.organizationId === "string" ? payload.organizationId : null,
        businessId: typeof payload.businessId === "string" ? payload.businessId : null,
        jobId: ledgerJobId,
        payload,
      }).catch(() => {});
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

async function claimLedgerJob(
  ledgerJobId: string,
  leaseOwner: string,
  workerLabel: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<
  | { kind: "claimed"; jobType: string; attempts: number; maxAttempts: number }
  | { kind: "skip"; status: string }
  | { kind: "busy" }
  | { kind: "not_ready"; delayMs: number }
> {
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
  const { data: claimed } = await supabase
    .from("job_queue")
    .update({
      status: "running",
      lifecycle_status: "running",
      started_at: nowIso,
      heartbeat_at: nowIso,
      worker_id: workerLabel,
      lease_owner: leaseOwner,
      lease_expires_at: leaseUntil,
    })
    .eq("id", ledgerJobId)
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .select("id, attempts, max_attempts, job_type")
    .maybeSingle();

  if (claimed) {
    const attempts = (claimed.attempts ?? 0) + 1;
    await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
    return {
      kind: "claimed",
      jobType: String(claimed.job_type ?? ""),
      attempts,
      maxAttempts: claimed.max_attempts ?? 3,
    };
  }

  const { data: row } = await supabase
    .from("job_queue")
    .select("status, job_type, lease_expires_at, scheduled_at, attempts, max_attempts")
    .eq("id", ledgerJobId)
    .maybeSingle();

  if (!row || TERMINAL_STATUSES.has(String(row.status))) {
    return { kind: "skip", status: String(row?.status ?? "missing") };
  }

  if (row.status === "pending" && row.scheduled_at) {
    const readyAt = new Date(String(row.scheduled_at)).getTime();
    if (readyAt > Date.now()) {
      return { kind: "not_ready", delayMs: Math.max(1_000, readyAt - Date.now()) };
    }
  }

  if (row.status === "running") {
    const leaseExpired =
      row.lease_expires_at != null &&
      new Date(String(row.lease_expires_at)).getTime() < Date.now();
    if (!leaseExpired) return { kind: "busy" };

    const { data: reclaimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        lifecycle_status: "running",
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        worker_id: workerLabel,
        lease_owner: leaseOwner,
        lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
      })
      .eq("id", ledgerJobId)
      .eq("status", "running")
      .lt("lease_expires_at", new Date().toISOString())
      .select("id, attempts, max_attempts, job_type")
      .maybeSingle();
    if (!reclaimed) return { kind: "busy" };

    const attempts = (reclaimed.attempts ?? 0) + 1;
    await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
    return {
      kind: "claimed",
      jobType: String(reclaimed.job_type ?? ""),
      attempts,
      maxAttempts: reclaimed.max_attempts ?? 3,
    };
  }

  return { kind: "busy" };
}

async function extendLease(ledgerJobId: string, leaseOwner: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
    })
    .eq("id", ledgerJobId)
    .eq("status", "running")
    .eq("lease_owner", leaseOwner)
    .select("id")
    .maybeSingle();
  if (!data) {
    throw new Error("Lost job lease");
  }
}

async function stillOwnsLease(ledgerJobId: string, leaseOwner: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("id")
    .eq("id", ledgerJobId)
    .eq("status", "running")
    .eq("lease_owner", leaseOwner)
    .maybeSingle();
  return Boolean(data);
}

async function markLedgerTerminal(
  ledgerJobId: string,
  status: "completed" | "failed",
  leaseOwner: string
): Promise<void> {
  const supabase = createServiceClient();
  // Optimistic completion: flush 100% progress immediately so the next poll settles.
  if (status === "completed") {
    const { updateJobProgress } = await import("@/lib/queue/ledger");
    await updateJobProgress(
      ledgerJobId,
      { completed: 1, total: 1, percent: 100 },
      { completed: 1, total: 1 },
      { force: true }
    ).catch(() => undefined);
  }
  await supabase
    .from("job_queue")
    .update({
      status,
      lifecycle_status: status === "completed" ? "completed" : "permanently_failed",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", ledgerJobId)
    .eq("status", "running")
    .eq("lease_owner", leaseOwner);
}

async function releaseReservedUsage(payload: JobHandlerPayload): Promise<void> {
  if (!payload.reservedUsage || !payload.organizationId) return;
  await releaseUsage(
    String(payload.organizationId),
    payload.reservedUsage.key as Parameters<typeof releaseUsage>[1],
    payload.reservedUsage.amount
  ).catch(() => {});
}

async function clearEarlyEnrichmentFlag(payload: JobHandlerPayload): Promise<void> {
  const scanBatchId = typeof payload.scanBatchId === "string" ? payload.scanBatchId : "";
  if (!scanBatchId) return;
  const supabase = createServiceClient();
  await supabase
    .from("scan_batches")
    .update({ early_enrichment_started: false })
    .eq("id", scanBatchId)
    .eq("early_enrichment_started", true);
}

function defaultJobTypeForQueue(queueName: QueueName): string {
  switch (queueName) {
    case "maps-scan":
      return "process_scan";
    case "maps-cell-retry":
      return "retry_scan_cells";
    case "review-import":
      return "import_contacts";
    case "review-campaign":
      return "campaign_send_batch";
    case "email-send":
      return "send_campaign_email";
    case "sms-send":
      return "send_campaign_sms";
    case "review-monitor":
      return "review_alert_scan";
    case "backlink-gap":
      return "backlink_gap_run";
    case "local-trust":
      return "local_trust_run";
    case "ai-visibility":
      return "ai_visibility_run";
    case "report-generation":
      return "generate_report";
    case "notifications":
      return "send_notification";
    case "maintenance":
      return "data_retention";
    default:
      return "data_retention";
  }
}

export function isPermanentError(err: unknown): boolean {
  return Boolean(err instanceof Error && (err as Error & { unrecoverable?: boolean }).unrecoverable);
}

export { isDeferredError, JobDeferredError } from "@/lib/queue/errors";

/** Expose for tests / worker lockDuration. */
export function bullmqLockDurationMs(_queueName: QueueName): number {
  // Keep locks short — BullMQ renews while the worker is alive. Long locks
  // only delay stalled-job recovery after a hard crash (amplifies duplicates).
  return 120_000;
}
