/**
 * Throttle high-frequency job_queue progress writes.
 *
 * Flush when any of these fire:
 * - ≥1s since last flush
 * - completed advanced by ≥5 units
 * - progress advanced by ≥5%
 * - force (terminal / 100% / explicit)
 */

export type ProgressCounters = {
  total?: number;
  completed?: number;
  failed?: number;
};

export type ThrottledProgressWrite = {
  progress: Record<string, unknown>;
  counters?: ProgressCounters;
};

type ThrottleState = {
  lastFlushAt: number;
  lastFlushedCompleted: number;
  lastFlushedPercent: number;
  version: number;
  pending: ThrottledProgressWrite | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
};

const FLUSH_MS = Number(process.env.JOB_PROGRESS_FLUSH_MS ?? 1000);
const UNIT_STEP = Number(process.env.JOB_PROGRESS_UNIT_STEP ?? 5);
const PERCENT_STEP = Number(process.env.JOB_PROGRESS_PERCENT_STEP ?? 5);

const byJob = new Map<string, ThrottleState>();
const seededJobs = new Set<string>();

function percentOf(counters?: ProgressCounters): number {
  const total = counters?.total;
  const completed = counters?.completed;
  if (total == null || total <= 0 || completed == null) return 0;
  return Math.round((completed / total) * 100);
}

function isComplete(counters?: ProgressCounters): boolean {
  const total = counters?.total;
  const completed = counters?.completed;
  return total != null && total > 0 && completed != null && completed >= total;
}

function getState(jobId: string): ThrottleState {
  let state = byJob.get(jobId);
  if (!state) {
    state = {
      // Start the time window on first sight so a single cell does not force a write.
      lastFlushAt: Date.now(),
      lastFlushedCompleted: 0,
      lastFlushedPercent: 0,
      version: 0,
      pending: null,
      flushTimer: null,
    };
    byJob.set(jobId, state);
  }
  return state;
}

export function shouldFlushProgress(params: {
  lastFlushAt: number;
  lastFlushedCompleted: number;
  lastFlushedPercent: number;
  counters?: ProgressCounters;
  force?: boolean;
  now?: number;
}): boolean {
  if (params.force) return true;
  if (isComplete(params.counters)) return true;
  const now = params.now ?? Date.now();
  if (now - params.lastFlushAt >= FLUSH_MS) return true;
  const completed = params.counters?.completed ?? 0;
  if (completed - params.lastFlushedCompleted >= UNIT_STEP) return true;
  const pct = percentOf(params.counters);
  if (pct - params.lastFlushedPercent >= PERCENT_STEP) return true;
  return false;
}

/**
 * Schedule a progress write. `writer` performs the actual DB update and
 * receives the next monotonic version to persist.
 */
export async function scheduleJobProgressWrite(
  jobId: string,
  write: ThrottledProgressWrite,
  writer: (payload: ThrottledProgressWrite & { version: number }) => Promise<void>,
  options?: {
    force?: boolean;
    /** Seed monotonic version from DB after worker restart (number or lazy loader). */
    seedVersion?: number | (() => Promise<number>);
  }
): Promise<{ flushed: boolean; version: number }> {
  const state = getState(jobId);
  if (!seededJobs.has(jobId)) {
    seededJobs.add(jobId);
    const raw = options?.seedVersion;
    const seed = typeof raw === "function" ? await raw() : raw;
    if (typeof seed === "number" && Number.isFinite(seed) && seed > state.version) {
      state.version = Math.floor(seed);
    }
  } else if (
    typeof options?.seedVersion === "number" &&
    options.seedVersion > state.version
  ) {
    state.version = Math.floor(options.seedVersion);
  }

  const prev = state.pending;
  const mergedCounters: ProgressCounters = {
    total: write.counters?.total ?? prev?.counters?.total,
    completed: Math.max(
      write.counters?.completed ?? 0,
      prev?.counters?.completed ?? 0
    ),
    failed: write.counters?.failed ?? prev?.counters?.failed,
  };
  state.pending = {
    progress: { ...(prev?.progress ?? {}), ...write.progress },
    counters: mergedCounters,
  };

  const flushNow = shouldFlushProgress({
    lastFlushAt: state.lastFlushAt,
    lastFlushedCompleted: state.lastFlushedCompleted,
    lastFlushedPercent: state.lastFlushedPercent,
    counters: mergedCounters,
    force: options?.force,
  });

  if (flushNow) {
    return flushJobProgress(jobId, writer, true);
  }

  if (!state.flushTimer) {
    const elapsed = Date.now() - state.lastFlushAt;
    state.flushTimer = setTimeout(() => {
      void flushJobProgress(jobId, writer, true).catch(() => undefined);
    }, Math.max(50, FLUSH_MS - elapsed));
  }

  return { flushed: false, version: state.version };
}

export async function flushJobProgress(
  jobId: string,
  writer: (payload: ThrottledProgressWrite & { version: number }) => Promise<void>,
  force = false
): Promise<{ flushed: boolean; version: number }> {
  const state = byJob.get(jobId);
  if (!state?.pending) return { flushed: false, version: state?.version ?? 0 };

  const due = shouldFlushProgress({
    lastFlushAt: state.lastFlushAt,
    lastFlushedCompleted: state.lastFlushedCompleted,
    lastFlushedPercent: state.lastFlushedPercent,
    counters: state.pending.counters,
    force,
  });
  if (!due) return { flushed: false, version: state.version };

  const payload = state.pending;
  state.pending = null;
  state.lastFlushAt = Date.now();
  state.lastFlushedCompleted = payload.counters?.completed ?? state.lastFlushedCompleted;
  state.lastFlushedPercent = percentOf(payload.counters);
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  state.version += 1;
  await writer({ ...payload, version: state.version });
  return { flushed: true, version: state.version };
}

/** Test helper */
export function resetProgressThrottleForTests(): void {
  for (const state of byJob.values()) {
    if (state.flushTimer) clearTimeout(state.flushTimer);
  }
  byJob.clear();
  seededJobs.clear();
}

export const __progressThrottleConfig = {
  FLUSH_MS,
  UNIT_STEP,
  PERCENT_STEP,
};
