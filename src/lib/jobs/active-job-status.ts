/**
 * Shared adaptive polling helpers for active background jobs.
 * Browser hook: `useActiveJobStatus` in components/jobs/use-active-job-status.ts
 *
 * Platform rule: poll only while work is actively changing. One loop per job ID.
 * Realtime/SSE may accelerate updates later; polling remains authoritative.
 */

export type ActiveJobPhase =
  | "queued"
  | "active"
  | "retrying"
  | "finalizing"
  | "completed"
  | "failed"
  | "unknown";

export type LightweightJobStatus = {
  jobId: string;
  status: string;
  phase: ActiveJobPhase;
  jobType?: string | null;
  progress?: {
    completed?: number;
    total?: number;
    failed?: number;
    percent?: number;
    result?: unknown;
  };
  /** Convenience: progress.result when the status API surfaces it. */
  result?: unknown;
  updatedAt?: string | null;
  errorMessage?: string | null;
  version?: number | null;
};

/** Compact wire format from GET /api/jobs/[jobId]/status */
export type CompactJobStatusResponse = {
  jobId: string;
  jobType: string | null;
  status: string;
  phase: ActiveJobPhase;
  progress: number | null;
  completedUnits: number | null;
  totalUnits: number | null;
  failedUnits: number | null;
  updatedAt: string | null;
  version: number;
  errorMessage: string | null;
  /** Present only when needed for settle handlers (small). */
  result?: unknown;
  enqueueState?: string | null;
  queueName?: string | null;
  /** True when status=running but heartbeat is older than the stall threshold. */
  stalled?: boolean;
};

const TERMINAL = new Set([
  "completed",
  "complete", // feature tables (growth audit, etc.)
  "failed",
  "cancelled",
  "canceled",
  "permanently_failed",
  "dead_letter",
]);

const ACTIVE = new Set([
  "pending",
  "pending_enqueue",
  "queued",
  "running",
  "retrying",
  "generating",
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "extended_running",
  "core_ready",
  "stalled", // keep polling — lease reclaim / recovery may revive it
]);

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function isActiveJobStatus(status: string): boolean {
  if (isTerminalJobStatus(status)) return false;
  if (ACTIVE.has(status)) return true;
  // Unknown non-terminal statuses still poll (safe default for new states).
  return status !== "unknown" && status.length > 0;
}

/**
 * Adaptive interval with the launch schedule:
 *   0–30s → 2s
 *   30–90s → 4s
 *   90s–5m → 8s
 *   5m+ → 15s
 * Plus ±20% jitter so clients do not align.
 */
export function nextPollIntervalMs(
  startedAtMs: number,
  _lastChangeAtMs: number,
  now = Date.now()
): number {
  const age = now - startedAtMs;
  let base: number;
  if (age < 30_000) base = 2000;
  else if (age < 90_000) base = 4000;
  else if (age < 5 * 60_000) base = 8000;
  else base = 15_000;
  return applyPollJitter(base);
}

/** Hidden-tab backoff — pause effectively; wake on visibility. */
export function hiddenPollIntervalMs(): number {
  return applyPollJitter(45_000);
}

export function applyPollJitter(baseMs: number, ratio = 0.2): number {
  const spread = Math.max(100, Math.floor(baseMs * ratio));
  const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread;
  return Math.max(500, baseMs + delta);
}

export function derivePhase(
  status: string,
  progress?: LightweightJobStatus["progress"]
): ActiveJobPhase {
  if (
    status === "completed" ||
    status === "complete" ||
    status === "ready" ||
    status === "rank_ready"
  ) {
    return "completed";
  }
  if (
    status === "failed" ||
    status === "permanently_failed" ||
    status === "dead_letter" ||
    status === "canceled" ||
    status === "cancelled"
  ) {
    return "failed";
  }
  if (
    status === "queued" ||
    status === "pending" ||
    status === "pending_enqueue" ||
    status === "generating"
  ) {
    return "queued";
  }
  if (status === "normalizing" || status === "enriching") return "finalizing";
  if (
    (progress?.failed ?? 0) > 0 &&
    (progress?.completed ?? 0) < (progress?.total ?? Infinity)
  ) {
    return "retrying";
  }
  if (status === "stalled" || status === "retrying") return "retrying";
  if (
    status === "dispatching" ||
    status === "provider_running" ||
    status === "running" ||
    status === "extended_running" ||
    status === "core_ready"
  ) {
    return "active";
  }
  return "unknown";
}

/** Map compact API → LightweightJobStatus for UI consumers. */
export function compactToLightweight(c: CompactJobStatusResponse): LightweightJobStatus {
  const progress = {
    completed: c.completedUnits ?? undefined,
    total: c.totalUnits ?? undefined,
    failed: c.failedUnits ?? undefined,
    percent: c.progress ?? undefined,
    result: c.result,
  };
  return {
    jobId: c.jobId,
    status: c.status,
    phase: c.phase || derivePhase(c.status, progress),
    jobType: c.jobType,
    progress,
    result: c.result ?? null,
    updatedAt: c.updatedAt,
    errorMessage: c.errorMessage,
    version: c.version,
  };
}
