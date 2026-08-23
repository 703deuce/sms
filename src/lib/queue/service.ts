import { getQueueDriverName, getRedisUrl, getRedisUrlEnvSource, getResolvedRedisHost } from "@/lib/queue/config";
import { databaseEnqueue } from "@/lib/queue/drivers/database-driver";
import {
  bullmqEnqueue,
  bullmqRequeueLedgerJob,
} from "@/lib/queue/drivers/bullmq-driver";
import {
  cancelLedgerJob,
  createLedgerJob,
  getLedgerJob,
  heartbeatJob,
  listEnqueueFailedJobs,
  markLedgerEnqueueFailed,
  markLedgerEnqueued,
  retryLedgerJob,
  updateJobProgress,
} from "@/lib/queue/ledger";
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  QueueDriverName,
  QueueJobRecord,
} from "@/lib/queue/types";
import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { releaseUsage, reserveUsageOrThrow, type UsageKey } from "@/lib/plans";
import { assertOrganizationCanEnqueue } from "@/lib/auth/org-status";

/**
 * Public queue API — feature code must call this (or dispatchFeatureJob), never BullMQ directly.
 *
 * Driver is explicit via QUEUE_DRIVER (never inferred from a flaky Redis ping).
 */
export function resolveQueueDriver(): QueueDriverName {
  const driver = getQueueDriverName();
  if (driver === "bullmq" && !getRedisUrl()) {
    logger.warn("queue_driver_bullmq_without_redis", {
      message: "QUEUE_DRIVER=bullmq but REDIS_URL is empty — enqueues will mark enqueue_failed",
    });
  }
  return driver;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  const driver = resolveQueueDriver();
  logger.info("job_enqueue_start", {
    jobType: input.jobType,
    queueName: input.queueName,
    organizationId: input.organizationId,
    businessId: input.businessId,
    driver,
    idempotencyKey: input.idempotencyKey ?? null,
    ...(driver === "bullmq"
      ? {
          redisHost: getResolvedRedisHost(),
          redisUrlSource: getRedisUrlEnvSource(),
        }
      : {}),
  });
  try {
    await assertOrganizationCanEnqueue(input.organizationId, input.jobType);
  } catch (err) {
    logger.error("job_enqueue_org_gate_failed", {
      jobType: input.jobType,
      organizationId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  if (driver === "bullmq") {
    if (!getRedisUrl()) {
      const row = await createLedgerJob(input);
      await markLedgerEnqueueFailed(row.id, "REDIS_URL missing with QUEUE_DRIVER=bullmq");
      const failed = {
        jobId: row.id,
        queueName: input.queueName,
        driver: "bullmq" as const,
        enqueueState: "enqueue_failed" as const,
        reused: false,
        status: "pending" as const,
      };
      logger.error("job_enqueue_failed", {
        jobType: input.jobType,
        jobId: failed.jobId,
        reason: "REDIS_URL missing with QUEUE_DRIVER=bullmq",
      });
      return failed;
    }
    const result = await bullmqEnqueue(input);
    logger.info("job_enqueue_result", {
      jobType: input.jobType,
      queueName: input.queueName,
      jobId: result.jobId,
      enqueueState: result.enqueueState,
      driver: result.driver,
      reused: result.reused,
    });
    return result;
  }
  const result = await databaseEnqueue(input);
  logger.info("job_enqueue_result", {
    jobType: input.jobType,
    queueName: input.queueName,
    jobId: result.jobId,
    enqueueState: result.enqueueState,
    driver: result.driver,
    reused: result.reused,
  });
  return result;
}

export async function getJobStatus(jobId: string): Promise<QueueJobRecord | null> {
  return getLedgerJob(jobId);
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const before = await getLedgerJob(jobId);
  const ok = await cancelLedgerJob(jobId);
  if (!ok) return false;
  if (resolveQueueDriver() === "bullmq" && getRedisUrl() && before?.queueName) {
    const { bullmqRemoveLedgerJob } = await import("@/lib/queue/drivers/bullmq-driver");
    await bullmqRemoveLedgerJob(before.queueName, jobId).catch(() => {});
  }
  await releaseReservedUsageFromPayload(before?.payload, before?.organizationId).catch(() => {});
  await failRelatedFeatureRowOnCancel(before).catch(() => {});
  return true;
}

async function releaseReservedUsageFromPayload(
  payload: Record<string, unknown> | undefined,
  organizationId: string | null | undefined
): Promise<void> {
  const reserved = payload?.reservedUsage as { key?: string; amount?: number } | undefined;
  const orgId =
    (typeof organizationId === "string" && organizationId) ||
    (typeof payload?.organizationId === "string" ? payload.organizationId : null);
  if (!reserved?.key || !orgId || !reserved.amount) return;
  await releaseUsage(orgId, reserved.key as UsageKey, Number(reserved.amount));
}

/** Best-effort: stop product UIs stuck on `running` after admin cancel. */
async function failRelatedFeatureRowOnCancel(
  job: QueueJobRecord | null | undefined
): Promise<void> {
  if (!job) return;
  const supabase = createServiceClient();
  const payload = job.payload ?? {};
  const finishedAt = new Date().toISOString();
  const finished = {
    status: "failed",
    error_message: "Canceled by operator",
    finished_at: finishedAt,
  };
  switch (job.jobType) {
    case "growth_audit_run":
    case "growth_audit_extended": {
      const runId = String(payload.growthRunId ?? "");
      let q = supabase
        .from("growth_audit_runs")
        .update(finished)
        .in("status", ["running", "core_ready", "extended_running"]);
      if (runId) q = q.eq("id", runId);
      else if (job.businessId && job.organizationId) {
        q = q.eq("business_id", job.businessId).eq("organization_id", job.organizationId);
      } else return;
      await q;
      break;
    }
    case "local_trust_run": {
      let q = supabase.from("local_trust_runs").update(finished).eq("status", "running");
      if (job.businessId && job.organizationId) {
        q = q.eq("business_id", job.businessId).eq("organization_id", job.organizationId);
      } else return;
      await q;
      break;
    }
    case "backlink_gap_run": {
      let q = supabase.from("backlink_gap_runs").update(finished).eq("status", "running");
      if (job.businessId && job.organizationId) {
        q = q.eq("business_id", job.businessId).eq("organization_id", job.organizationId);
      } else return;
      await q;
      break;
    }
    case "ai_visibility_run": {
      let q = supabase.from("ai_visibility_runs").update(finished).eq("status", "running");
      if (job.businessId && job.organizationId) {
        q = q.eq("business_id", job.businessId).eq("organization_id", job.organizationId);
      } else return;
      await q;
      break;
    }
    case "import_contacts": {
      const uploadId = String(payload.uploadId ?? "");
      if (!uploadId) return;
      await supabase
        .from("review_request_uploads")
        .update({
          status: "failed",
          error_report_json: [{ row: 0, error: "Canceled by operator" }],
          completed_at: finishedAt,
        })
        .eq("id", uploadId)
        .in("status", ["queued", "running"]);
      break;
    }
    case "process_scan":
    case "retry_scan_cells": {
      const scanBatchId = String(payload.scanBatchId ?? "");
      if (!scanBatchId) return;
      await supabase
        .from("scan_batches")
        .update({
          status: "failed",
          error_message: "Canceled by operator",
          finished_at: finishedAt,
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", scanBatchId)
        .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
      const orgId =
        job.organizationId ||
        (typeof payload.organizationId === "string" ? payload.organizationId : null);
      if (orgId) {
        const { maybeReleaseUnusedMapCredits } = await import("@/lib/jobs/map-credits");
        await maybeReleaseUnusedMapCredits(
          scanBatchId,
          orgId,
          "Canceled by operator"
        ).catch(() => {});
      }
      break;
    }
    default:
      break;
  }
}

export async function retryJob(jobId: string): Promise<boolean> {
  // Refuse retry while a live worker still holds a valid lease.
  const supabase = createServiceClient();
  const { data: live } = await supabase
    .from("job_queue")
    .select("status, lease_expires_at, lease_owner")
    .eq("id", jobId)
    .maybeSingle();
  if (
    live?.status === "running" &&
    live.lease_owner &&
    live.lease_expires_at &&
    new Date(String(live.lease_expires_at)).getTime() > Date.now()
  ) {
    return false;
  }

  const beforeRetry = await getLedgerJob(jobId);
  const ok = await retryLedgerJob(jobId);
  if (!ok) return false;

  // Terminal failure already refunded reservedUsage — re-charge on explicit retry.
  const reserved = beforeRetry?.payload?.reservedUsage as
    | { key?: string; amount?: number }
    | undefined;
  const orgId =
    beforeRetry?.organizationId ||
    (typeof beforeRetry?.payload?.organizationId === "string"
      ? beforeRetry.payload.organizationId
      : null);
  if (reserved?.key && orgId && reserved.amount) {
    try {
      await reserveUsageOrThrow(orgId, reserved.key as UsageKey, Number(reserved.amount));
    } catch (err) {
      await createServiceClient()
        .from("job_queue")
        .update({
          status: "failed",
          lifecycle_status: "permanently_failed",
          error_message:
            err instanceof Error ? err.message : "Usage limit reached on retry",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "pending");
      return false;
    }
  }

  if (resolveQueueDriver() === "bullmq" && getRedisUrl()) {
    const job = await getLedgerJob(jobId);
    if (job?.queueName) {
      try {
        await bullmqRequeueLedgerJob({
          id: job.id,
          queueName: job.queueName,
          jobType: job.jobType,
          payload: job.payload,
          organizationId: job.organizationId,
          businessId: job.businessId,
          priority: job.priority,
          maxAttempts: job.maxAttempts,
        });
      } catch (err) {
        await markLedgerEnqueueFailed(
          job.id,
          err instanceof Error ? err.message : "retry requeue failed"
        );
        return false;
      }
    }
  } else {
    const job = await getLedgerJob(jobId);
    if (job) {
      await markLedgerEnqueued(job.id, { queueJobId: job.id, enqueueState: "enqueued" });
    }
  }
  return true;
}

export async function updateProgress(
  jobId: string,
  progress: Record<string, unknown>,
  counters?: { total?: number; completed?: number; failed?: number },
  options?: { force?: boolean }
): Promise<void> {
  await updateJobProgress(jobId, progress, counters, options);
}

export async function heartbeat(
  jobId: string,
  opts?: { workerId?: string; leaseMs?: number }
): Promise<void> {
  await heartbeatJob(jobId, opts);
}

/**
 * Re-attempt BullMQ handoff for ledger rows stuck in enqueue_failed.
 * Does not create a second ledger row — reuses the same job id.
 */
export async function recoverPendingEnqueues(limit = 25): Promise<number> {
  if (resolveQueueDriver() !== "bullmq" || !getRedisUrl()) return 0;

  const failed = await listEnqueueFailedJobs(limit);
  let recovered = 0;
  for (const job of failed) {
    if (!job.queueName) continue;
    try {
      await bullmqRequeueLedgerJob({
        id: job.id,
        queueName: job.queueName,
        jobType: job.jobType,
        payload: job.payload,
        organizationId: job.organizationId,
        businessId: job.businessId,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
      });
      recovered++;
    } catch (err) {
      logger.warn("queue_enqueue_recovery_item_failed", {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (recovered > 0) {
    logger.info("queue_enqueue_recovery", { recovered, scanned: failed.length });
  }
  return recovered;
}

/**
 * Upgrade legacy/SQL-inserted process_scan rows so BullMQ can see them.
 * Safe under database driver too (fills queue_name / enqueue_state).
 */
export async function reconcileLegacyPendingJobs(limit = 25): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("id, job_type, payload, organization_id, business_id, queue_name, enqueue_state, priority, max_attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit * 3);

  const rows = (data ?? []).filter(
    (row) =>
      !row.queue_name ||
      row.enqueue_state === "pending" ||
      row.enqueue_state === "enqueue_failed" ||
      row.enqueue_state == null
  );
  let fixed = 0;
  for (const row of rows.slice(0, limit)) {
    const jobType = String(row.job_type);
    const queueName = jobTypeToQueue(jobType);
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    await supabase
      .from("job_queue")
      .update({
        queue_name: queueName,
        enqueue_state: "enqueued",
        queue_job_id: row.id,
      })
      .eq("id", row.id);

    if (resolveQueueDriver() === "bullmq" && getRedisUrl()) {
      try {
        await bullmqRequeueLedgerJob({
          id: row.id,
          queueName,
          jobType,
          payload,
          organizationId: (row.organization_id as string | null) ?? null,
          businessId: (row.business_id as string | null) ?? null,
          priority: Number(row.priority ?? 50),
          maxAttempts: Number(row.max_attempts ?? 3),
        });
      } catch (err) {
        await markLedgerEnqueueFailed(
          row.id,
          err instanceof Error ? err.message : "reconcile requeue failed"
        );
        continue;
      }
    } else {
      await markLedgerEnqueued(row.id, { queueJobId: row.id, enqueueState: "enqueued" });
    }
    fixed++;
  }
  if (fixed > 0) logger.info("queue_legacy_reconciled", { fixed });
  return fixed;
}

export async function enqueueMapsScanJob(params: {
  scanBatchId: string;
  businessId: string;
  organizationId: string;
  priority?: EnqueueJobInput["priority"];
}): Promise<EnqueueJobResult> {
  return enqueueJob({
    queueName: "maps-scan",
    jobType: "process_scan",
    payload: {
      scanBatchId: params.scanBatchId,
      businessId: params.businessId,
      organizationId: params.organizationId,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    relatedResourceId: params.scanBatchId,
    idempotencyKey: `maps-scan:${params.scanBatchId}`,
    priority: params.priority ?? "highest",
    maxAttempts: 3,
  });
}

export async function enqueueReviewImportJob(params: {
  uploadId: string;
  businessId: string;
  organizationId: string;
  mode: string;
}): Promise<EnqueueJobResult> {
  return enqueueJob({
    queueName: "review-import",
    jobType: "import_contacts",
    payload: {
      uploadId: params.uploadId,
      businessId: params.businessId,
      organizationId: params.organizationId,
      mode: params.mode,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    idempotencyKey: `review-import:${params.uploadId}`,
    priority: "normal",
    maxAttempts: 3,
  });
}

export async function enqueueScanEnrichmentJob(params: {
  scanBatchId: string;
  organizationId?: string;
  businessId?: string;
  parentJobId?: string | null;
}): Promise<EnqueueJobResult> {
  return enqueueJob({
    queueName: "maps-scan",
    jobType: "scan_enrichment",
    payload: {
      scanBatchId: params.scanBatchId,
      organizationId: params.organizationId,
      businessId: params.businessId,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    parentJobId: params.parentJobId,
    relatedResourceId: params.scanBatchId,
    idempotencyKey: `scan-enrichment:${params.scanBatchId}`,
    priority: "normal",
    maxAttempts: 2,
  });
}
