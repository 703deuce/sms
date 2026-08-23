import { createServiceClient } from "@/lib/db/client";
import { randomUUID } from "crypto";
import type {
  EnqueueJobInput,
  EnqueueState,
  QueueJobRecord,
} from "@/lib/queue/types";
import { PRIORITY_SCORES } from "@/lib/queue/types";
import { canReuseExistingJob } from "@/lib/queue/idempotency";
import { logger } from "@/lib/observability/logger";

function priorityScore(priority: EnqueueJobInput["priority"]): number {
  if (typeof priority === "number" && Number.isFinite(priority)) return priority;
  if (priority === "highest" || priority === "normal" || priority === "lower") {
    return PRIORITY_SCORES[priority];
  }
  return PRIORITY_SCORES.normal;
}

export async function findJobByIdempotencyKey(
  idempotencyKey: string
): Promise<QueueJobRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return rowToRecord(data);
}

export async function createLedgerJob(input: EnqueueJobInput): Promise<QueueJobRecord> {
  const supabase = createServiceClient();
  const scheduledAt = new Date(Date.now() + (input.delayMs ?? 0)).toISOString();
  const { data, error } = await supabase
    .from("job_queue")
    .insert({
      id: randomUUID(),
      job_type: input.jobType,
      payload: input.payload,
      status: "pending",
      organization_id: input.organizationId ?? null,
      business_id: input.businessId ?? null,
      parent_job_id: input.parentJobId ?? null,
      related_resource_id: input.relatedResourceId ?? null,
      initiated_by_user_id: input.initiatedByUserId ?? null,
      queue_name: input.queueName,
      priority: priorityScore(input.priority),
      idempotency_key: input.idempotencyKey ?? null,
      max_attempts: input.maxAttempts ?? 3,
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
      // enqueue_state stays on legacy enum until migration 045; lifecycle_status carries the platform vocabulary.
      enqueue_state: "pending",
      lifecycle_status: "pending_enqueue",
      cost_estimate: input.costEstimate ?? null,
      progress_json: {},
      progress_completed: 0,
      progress_failed: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Unique idempotency race — reuse live work, or free the key on terminal rows.
    if (input.idempotencyKey && /duplicate|unique/i.test(error?.message ?? "")) {
      const existing = await findJobByIdempotencyKey(input.idempotencyKey);
      if (existing && canReuseExistingJob(existing)) return existing;
      if (existing) {
        // Free key on terminal / enqueue_failed / half-created so a new run can proceed.
        await clearIdempotencyKey(existing.id);
        const retry = await supabase
          .from("job_queue")
          .insert({
            id: randomUUID(),
            job_type: input.jobType,
            payload: input.payload,
            status: "pending",
            organization_id: input.organizationId ?? null,
            business_id: input.businessId ?? null,
            parent_job_id: input.parentJobId ?? null,
            related_resource_id: input.relatedResourceId ?? null,
            initiated_by_user_id: input.initiatedByUserId ?? null,
            queue_name: input.queueName,
            priority: priorityScore(input.priority),
            idempotency_key: input.idempotencyKey ?? null,
            max_attempts: input.maxAttempts ?? 3,
            scheduled_at: scheduledAt,
            updated_at: new Date().toISOString(),
            enqueue_state: "pending",
            lifecycle_status: "pending_enqueue",
            cost_estimate: input.costEstimate ?? null,
            progress_json: {},
            progress_completed: 0,
            progress_failed: 0,
          })
          .select("*")
          .single();
        if (retry.data) return rowToRecord(retry.data);
        const again = await findJobByIdempotencyKey(input.idempotencyKey);
        if (again && canReuseExistingJob(again)) return again;
      }
    }
    logger.error("job_queue_insert_failed", {
      jobType: input.jobType,
      queueName: input.queueName,
      organizationId: input.organizationId,
      businessId: input.businessId,
      pgMessage: error?.message,
      pgCode: error?.code,
      pgDetails: error?.details,
      pgHint: error?.hint,
    });
    throw new Error(error?.message ?? "Failed to create job ledger row");
  }
  return rowToRecord(data);
}

/** Free idempotency_key so a new non-reusable conflict can insert a fresh row. */
async function clearIdempotencyKey(jobId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("job_queue").update({ idempotency_key: null }).eq("id", jobId);
}

export async function markLedgerEnqueued(
  jobId: string,
  opts: { queueJobId?: string | null; enqueueState?: EnqueueState } = {}
): Promise<void> {
  const supabase = createServiceClient();
  // Never reopen terminal rows (unique-collision / stale recovery races).
  await supabase
    .from("job_queue")
    .update({
      enqueue_state: opts.enqueueState ?? "enqueued",
      queue_job_id: opts.queueJobId ?? jobId,
      lifecycle_status: "queued",
      enqueued_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending");
}

export async function markLedgerEnqueueFailed(jobId: string, message: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      enqueue_state: "enqueue_failed",
      lifecycle_status: "enqueue_failed",
      error_message: message,
      error_code: "enqueue_failed",
      error_class: "enqueue",
      customer_error: "We could not start this job. It will be retried automatically.",
    })
    .eq("id", jobId)
    .eq("status", "pending");
}

export async function updateJobProgress(
  jobId: string,
  progress: Record<string, unknown>,
  counters?: { total?: number; completed?: number; failed?: number },
  options?: { force?: boolean }
): Promise<void> {
  const { scheduleJobProgressWrite } = await import("@/lib/queue/progress-throttle");
  const supabase = createServiceClient();

  await scheduleJobProgressWrite(
    jobId,
    { progress, counters },
    async ({ progress: merged, counters: c, version }) => {
      await supabase
        .from("job_queue")
        .update({
          progress_json: merged,
          progress_version: version,
          heartbeat_at: new Date().toISOString(),
          ...(c?.total != null ? { progress_total: c.total } : {}),
          ...(c?.completed != null ? { progress_completed: c.completed } : {}),
          ...(c?.failed != null ? { progress_failed: c.failed } : {}),
        })
        .eq("id", jobId);
    },
    {
      force: options?.force === true,
      seedVersion: async () => {
        const { data } = await supabase
          .from("job_queue")
          .select("progress_version")
          .eq("id", jobId)
          .maybeSingle();
        return Number((data as { progress_version?: number } | null)?.progress_version ?? 0);
      },
    }
  );
}

export async function heartbeatJob(
  jobId: string,
  opts: { workerId?: string; leaseMs?: number } = {}
): Promise<void> {
  const supabase = createServiceClient();
  const leaseMs = opts.leaseMs ?? 60_000;
  let query = supabase
    .from("job_queue")
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + leaseMs).toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "running");
  // When a lease owner is provided, only that claim may refresh the lease.
  if (opts.workerId) {
    query = query.eq("lease_owner", opts.workerId);
  }
  await query;
}

/** Conditional cancel — only from non-terminal statuses. */
export async function cancelLedgerJob(jobId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .update({
      status: "canceled",
      lifecycle_status: "canceled",
      canceled_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
      worker_id: null,
    })
    .eq("id", jobId)
    .in("status", ["pending", "running"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

/** Re-queue a failed/canceled job for another attempt. */
export async function retryLedgerJob(jobId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .update({
      status: "pending",
      lifecycle_status: "queued",
      enqueue_state: "pending",
      attempts: 0,
      scheduled_at: new Date().toISOString(),
      error_message: null,
      error_code: null,
      error_class: null,
      customer_error: null,
      finished_at: null,
      canceled_at: null,
      lease_owner: null,
      lease_expires_at: null,
      worker_id: null,
      started_at: null,
    })
    .eq("id", jobId)
    .in("status", ["failed", "canceled", "cancelled"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function markLifecycle(
  jobId: string,
  lifecycle: string,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({ lifecycle_status: lifecycle, ...patch })
    .eq("id", jobId);
}

export async function getLedgerJob(jobId: string): Promise<QueueJobRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("job_queue").select("*").eq("id", jobId).maybeSingle();
  if (!data) return null;
  return rowToRecord(data);
}

export async function listEnqueueFailedJobs(limit = 20): Promise<QueueJobRecord[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .select("*")
    .eq("enqueue_state", "enqueue_failed")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map(rowToRecord);
}

export type AdminJobListFilters = {
  status?: string | null;
  jobType?: string | null;
  organizationId?: string | null;
  q?: string | null;
  limit?: number;
};

export type AdminJobRow = QueueJobRecord & {
  lifecycleStatus?: string | null;
  createdAt?: string;
  relatedResourceId?: string | null;
  /** For Maps jobs: scan_batches.status when resolvable. */
  relatedScanStatus?: string | null;
  /** True when ledger is completed but related scan is still in-flight. */
  statusMismatch?: boolean;
};

/** Admin ops search — newest first. */
export async function listJobsForAdmin(
  filters: AdminJobListFilters = {}
): Promise<AdminJobRow[]> {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  let query = supabase
    .from("job_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.jobType) query = query.eq("job_type", filters.jobType);
  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.q) {
    const q = filters.q.trim();
    if (/^[0-9a-f-]{36}$/i.test(q)) {
      query = query.or(`id.eq.${q},business_id.eq.${q},organization_id.eq.${q}`);
    } else {
      query = query.ilike("job_type", `%${q}%`);
    }
  }

  const { data } = await query;
  const rows = data ?? [];
  const scanIds = new Set<string>();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const scanId =
      (typeof payload.scanBatchId === "string" && payload.scanBatchId) ||
      (typeof row.related_resource_id === "string" &&
      ["process_scan", "scan_enrichment", "early_enrichment", "retry_scan_cells"].includes(
        String(row.job_type)
      )
        ? row.related_resource_id
        : null);
    if (scanId) scanIds.add(scanId);
  }

  const scanStatusById = new Map<string, string>();
  if (scanIds.size) {
    const { data: scans } = await supabase
      .from("scan_batches")
      .select("id, status")
      .in("id", [...scanIds]);
    for (const s of scans ?? []) {
      scanStatusById.set(String(s.id), String(s.status));
    }
  }

  const inFlightScan = new Set([
    "queued",
    "dispatching",
    "provider_running",
    "normalizing",
  ]);

  return rows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const relatedResourceId = (row.related_resource_id as string | null) ?? null;
    const scanId =
      (typeof payload.scanBatchId === "string" && payload.scanBatchId) ||
      relatedResourceId;
    const relatedScanStatus = scanId ? scanStatusById.get(scanId) ?? null : null;
    const jobStatus = String(row.status ?? "");
    const statusMismatch = Boolean(
      jobStatus === "completed" &&
        relatedScanStatus &&
        inFlightScan.has(relatedScanStatus)
    );
    return {
      ...rowToRecord(row),
      lifecycleStatus: (row.lifecycle_status as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
      relatedResourceId,
      relatedScanStatus,
      statusMismatch,
    };
  });
}

export async function countJobsByStatus(): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const statuses = ["pending", "running", "completed", "failed", "canceled"] as const;
  const counts: Record<string, number> = {};
  await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from("job_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count ?? 0;
    })
  );
  const { count: enqueueFailed } = await supabase
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("enqueue_state", "enqueue_failed");
  counts.enqueue_failed = enqueueFailed ?? 0;
  const { count: deadLetter } = await supabase
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle_status", "dead_letter");
  counts.dead_letter = deadLetter ?? 0;
  return counts;
}

/** Pending/running/failed job counts grouped for admin ops (Maps vs Messaging vs Reports). */
export async function countJobsByQueueGroup(): Promise<{
  maps: { pending: number; running: number; failed: number };
  messaging: { pending: number; running: number; failed: number };
  reports: { pending: number; running: number; failed: number };
  maintenance: { pending: number; running: number; failed: number };
}> {
  const supabase = createServiceClient();
  const groups = {
    maps: ["maps-scan", "maps-cell-retry"],
    messaging: [
      "review-campaign",
      "email-send",
      "sms-send",
      "review-import",
      "review-monitor",
      "notifications",
    ],
    reports: ["report-generation"],
    maintenance: [
      "maintenance",
      "backlink-gap",
      "local-trust",
      "ai-visibility",
    ],
  } as const;

  async function tally(queues: readonly string[]) {
    const out = { pending: 0, running: 0, failed: 0 };
    await Promise.all(
      (["pending", "running", "failed"] as const).map(async (status) => {
        const { count } = await supabase
          .from("job_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", status)
          .in("queue_name", [...queues]);
        out[status] = count ?? 0;
      })
    );
    return out;
  }

  const [maps, messaging, reports, maintenance] = await Promise.all([
    tally(groups.maps),
    tally(groups.messaging),
    tally(groups.reports),
    tally(groups.maintenance),
  ]);
  return { maps, messaging, reports, maintenance };
}

/** Campaign message pipeline depth for admin ops. */
export async function countCampaignMessagePipeline(): Promise<{
  queued: number;
  sending: number;
  failed: number;
}> {
  const supabase = createServiceClient();
  const out = { queued: 0, sending: 0, failed: 0 };
  await Promise.all(
    (["queued", "sending", "failed"] as const).map(async (status) => {
      const { count } = await supabase
        .from("review_request_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      out[status] = count ?? 0;
    })
  );
  return out;
}

/**
 * Requeue jobs whose lease expired (worker crash) even if started_at is recent.
 * Single conditional update — avoids TOCTOU steal after a heartbeat renews the lease.
 * @returns reclaimed job ids
 */
export async function reclaimExpiredJobLeases(limit = 50): Promise<string[]> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  // PostgREST cannot LIMIT an UPDATE directly; select candidates then re-check expiry.
  const { data: expired } = await supabase
    .from("job_queue")
    .select("id")
    .eq("status", "running")
    .lt("lease_expires_at", now)
    .limit(limit);
  const ids = (expired ?? []).map((r) => r.id as string);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("job_queue")
    .update({
      status: "pending",
      lifecycle_status: "queued",
      lease_owner: null,
      lease_expires_at: null,
      scheduled_at: now,
      error_message: "Reclaimed expired job lease",
    })
    .in("id", ids)
    .eq("status", "running")
    .lt("lease_expires_at", now)
    .select("id");
  return (data ?? []).map((r) => r.id as string);
}

function rowToRecord(data: Record<string, unknown>): QueueJobRecord {
  return {
    id: String(data.id),
    queueName: (data.queue_name as QueueJobRecord["queueName"]) ?? null,
    jobType: String(data.job_type),
    payload: (data.payload as Record<string, unknown>) ?? {},
    status: String(data.status),
    enqueueState: (data.enqueue_state as EnqueueState) ?? "pending",
    organizationId: (data.organization_id as string | null) ?? null,
    businessId: (data.business_id as string | null) ?? null,
    priority: Number(data.priority ?? 50),
    attempts: Number(data.attempts ?? 0),
    maxAttempts: Number(data.max_attempts ?? 3),
    progress: (data.progress_json as Record<string, unknown>) ?? {},
    errorMessage: (data.error_message as string | null) ?? null,
    scheduledAt: String(data.scheduled_at),
    startedAt: (data.started_at as string | null) ?? null,
    finishedAt: (data.finished_at as string | null) ?? null,
    heartbeatAt: (data.heartbeat_at as string | null) ?? null,
  };
}
