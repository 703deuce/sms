"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  compactToLightweight,
  derivePhase,
  hiddenPollIntervalMs,
  isTerminalJobStatus,
  nextPollIntervalMs,
  type CompactJobStatusResponse,
  type LightweightJobStatus,
} from "@/lib/jobs/active-job-status";

type Options = {
  /** Absolute or relative status URL returning LightweightJobStatus-compatible JSON. */
  statusUrl: string | null;
  enabled?: boolean;
  /**
   * Optional terminal detector for feature-status adapters
   * (growth audit, imports) that don't use job_queue statuses.
   */
  isTerminal?: (status: string, json: Record<string, unknown>) => boolean;
  /** Optional mapper when the endpoint is not the compact job-status shape. */
  mapResponse?: (json: Record<string, unknown>) => LightweightJobStatus;
};

type Snapshot = {
  version: number;
  status: LightweightJobStatus | null;
  error: string | null;
};

type CacheEntry = {
  /** Stable snapshot reference — replaced only in bump() for useSyncExternalStore. */
  snapshot: Snapshot;
  listeners: Set<() => void>;
  inFlight: boolean;
  abort: AbortController | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  lastChangeAt: number;
  refCount: number;
  onVis: (() => void) | null;
  etag: string | null;
  /** Consecutive 404s before we treat the job as missing (enqueue race). */
  notFoundCount: number;
  isTerminal: Options["isTerminal"];
  mapResponse: Options["mapResponse"];
};

const cache = new Map<string, CacheEntry>();
const emptySnapshot: Snapshot = { version: 0, status: null, error: null };

/** Stable no-op subscribe for disabled polling (must keep referential identity). */
const subscribeDisabled = () => () => {};

function getEntry(url: string): CacheEntry {
  let entry = cache.get(url);
  if (!entry) {
    entry = {
      snapshot: { version: 0, status: null, error: null },
      listeners: new Set(),
      inFlight: false,
      abort: null,
      timeoutId: null,
      startedAt: Date.now(),
      lastChangeAt: Date.now(),
      refCount: 0,
      onVis: null,
      etag: null,
      notFoundCount: 0,
      isTerminal: undefined,
      mapResponse: undefined,
    };
    cache.set(url, entry);
  }
  return entry;
}

function bump(entry: CacheEntry, next?: Partial<Pick<Snapshot, "status" | "error">>) {
  entry.snapshot = {
    version: entry.snapshot.version + 1,
    status: next && "status" in next ? (next.status ?? null) : entry.snapshot.status,
    error: next && "error" in next ? (next.error ?? null) : entry.snapshot.error,
  };
  for (const l of entry.listeners) l();
}

function schedule(url: string, ms: number) {
  const entry = getEntry(url);
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(() => {
    void tick(url);
  }, ms);
}

function terminalFor(entry: CacheEntry, status: string, json: Record<string, unknown>): boolean {
  if (entry.isTerminal) return entry.isTerminal(status, json);
  return isTerminalJobStatus(status);
}

function defaultMap(json: Record<string, unknown>): LightweightJobStatus {
  // New compact shape
  if (typeof json.version === "number" || "completedUnits" in json) {
    const compact = {
      jobId: String(json.jobId ?? json.id ?? ""),
      jobType: (json.jobType as string | null) ?? null,
      status: String(json.status ?? "unknown"),
      phase: (json.phase as CompactJobStatusResponse["phase"]) ?? "unknown",
      progress: (json.progress as number | null) ?? null,
      completedUnits: (json.completedUnits as number | null) ?? null,
      totalUnits: (json.totalUnits as number | null) ?? null,
      failedUnits: (json.failedUnits as number | null) ?? null,
      updatedAt: (json.updatedAt as string | null) ?? null,
      version: Number(json.version ?? 0),
      errorMessage: (json.errorMessage as string | null) ?? null,
      result: json.result,
    } satisfies CompactJobStatusResponse;
    // Prefer nested progress object when present (compat).
    if (json.progress && typeof json.progress === "object") {
      const p = json.progress as LightweightJobStatus["progress"];
      return {
        jobId: compact.jobId,
        status: compact.status,
        phase: derivePhase(compact.status, p),
        jobType: compact.jobType,
        progress: p,
        result: json.result ?? p?.result ?? null,
        updatedAt: compact.updatedAt,
        errorMessage: compact.errorMessage,
        version: compact.version,
      };
    }
    return compactToLightweight(compact);
  }

  const progress = json.progress as LightweightJobStatus["progress"];
  return {
    jobId: String(json.jobId ?? json.id ?? ""),
    status: String(json.status ?? "unknown"),
    phase: derivePhase(String(json.status ?? "unknown"), progress),
    progress,
    result: json.result ?? progress?.result ?? null,
    updatedAt: (json.updatedAt as string | null) ?? null,
    errorMessage: (json.errorMessage as string | null) ?? null,
    version: typeof json.version === "number" ? json.version : null,
  };
}

async function tick(url: string, opts?: { force?: boolean }) {
  const entry = getEntry(url);
  if (entry.refCount <= 0) return;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    // Pause hard while hidden — next visibilitychange triggers immediate reconcile.
    schedule(url, hiddenPollIntervalMs());
    return;
  }

  if (entry.inFlight) {
    // Wake/force while a request is open: abort it and retry shortly.
    if (opts?.force) {
      entry.abort?.abort();
      schedule(url, 50);
    }
    return;
  }
  const current = entry.snapshot.status;
  if (current && terminalFor(entry, current.status, {})) return;

  entry.inFlight = true;
  entry.abort?.abort();
  const controller = new AbortController();
  entry.abort = controller;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (entry.etag) headers["If-None-Match"] = entry.etag;

    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    if (res.status === 304) {
      if (entry.refCount > 0 && !terminalFor(entry, entry.snapshot.status?.status ?? "", {})) {
        schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
      }
      return;
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = String(json.error ?? `Status ${res.status}`);
      if (res.status === 429) {
        const retry =
          typeof json.retryAfterMs === "number" ? json.retryAfterMs : 1000;
        if (entry.refCount > 0) schedule(url, retry);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        bump(entry, {
          error: message,
          status: {
            jobId: String(json.jobId ?? url),
            status: "failed",
            phase: "failed",
            errorMessage: message,
          },
        });
        return;
      }
      // 404 right after enqueue is often a brief race (ledger row not visible yet)
      // or a schema-lag select failure — retry before killing the Run UI.
      if (res.status === 404) {
        entry.notFoundCount += 1;
        if (entry.notFoundCount < 5 && entry.refCount > 0) {
          schedule(url, 400 * entry.notFoundCount);
          return;
        }
        bump(entry, {
          error: message,
          status: {
            jobId: String(json.jobId ?? url),
            status: "failed",
            phase: "failed",
            errorMessage: message,
          },
        });
        return;
      }
      throw new Error(message);
    }

    const etag = res.headers.get("etag");
    if (etag) entry.etag = etag;

    const mapped = entry.mapResponse ? entry.mapResponse(json) : defaultMap(json);
    const prev = entry.snapshot.status;
    const changed =
      mapped.status !== prev?.status ||
      mapped.updatedAt !== prev?.updatedAt ||
      mapped.version !== prev?.version ||
      mapped.progress?.completed !== prev?.progress?.completed;

    entry.notFoundCount = 0;
    if (changed) entry.lastChangeAt = Date.now();
    bump(entry, { status: mapped, error: null });

    if (entry.refCount > 0 && !terminalFor(entry, mapped.status, json)) {
      schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
    }
  } catch (err) {
    // Aborted because a newer tick/unmount won — do not reschedule here.
    if (err instanceof DOMException && err.name === "AbortError") return;
    if (controller.signal.aborted) return;
    bump(entry, {
      error: err instanceof Error ? err.message : "Status poll failed",
    });
    if (entry.refCount > 0) {
      schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
    }
  } finally {
    if (entry.abort === controller) {
      entry.inFlight = false;
    }
  }
}

function subscribeToUrl(url: string, onStoreChange: () => void) {
  const entry = getEntry(url);
  entry.listeners.add(onStoreChange);
  entry.refCount += 1;
  if (entry.refCount === 1) {
    entry.startedAt = Date.now();
    entry.lastChangeAt = Date.now();
    entry.etag = null;
    entry.notFoundCount = 0;
    void tick(url);
    entry.onVis = () => {
      if (document.visibilityState === "visible" && entry.refCount > 0) {
        // Immediate reconciliation when the tab wakes (force past in-flight).
        void tick(url, { force: true });
      }
    };
    document.addEventListener("visibilitychange", entry.onVis);
  }
  return () => {
    entry.listeners.delete(onStoreChange);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.abort?.abort();
      if (entry.onVis) document.removeEventListener("visibilitychange", entry.onVis);
      cache.delete(url);
    }
  };
}

/**
 * Poll a lightweight job/feature status endpoint only while active.
 * Deduplicates across components watching the same URL. Stops on terminal
 * status, unmount, and pauses when the tab is hidden.
 */
export function useActiveJobStatus(options: Options): {
  status: LightweightJobStatus | null;
  error: string | null;
  isPolling: boolean;
} {
  const enabled = options.enabled !== false && Boolean(options.statusUrl);
  const url = enabled ? options.statusUrl! : null;

  // Keep latest adapters on the cache entry without changing subscribe identity.
  // Inline isTerminal/mapResponse from parents used to force re-subscribe every
  // render → cache delete → new snapshot → React #185 (max update depth).
  const isTerminalRef = useRef(options.isTerminal);
  const mapResponseRef = useRef(options.mapResponse);
  isTerminalRef.current = options.isTerminal;
  mapResponseRef.current = options.mapResponse;

  useEffect(() => {
    if (!url) return;
    const entry = getEntry(url);
    entry.isTerminal = isTerminalRef.current;
    entry.mapResponse = mapResponseRef.current;
  }, [url, options.isTerminal, options.mapResponse]);

  // subscribe/getSnapshot identities must only change when the URL changes.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!url) return subscribeDisabled();
      const entry = getEntry(url);
      entry.isTerminal = isTerminalRef.current;
      entry.mapResponse = mapResponseRef.current;
      return subscribeToUrl(url, onChange);
    },
    [url]
  );

  const getSnapshot = useCallback(() => {
    if (!url) return emptySnapshot;
    return getEntry(url).snapshot;
  }, [url]);

  const getServerSnapshot = useCallback(() => emptySnapshot, []);

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const terminal = snap.status
    ? options.isTerminal
      ? options.isTerminal(snap.status.status, {})
      : isTerminalJobStatus(snap.status.status)
    : false;

  return {
    status: snap.status,
    error: snap.error,
    // True from subscribe until terminal — including before the first response.
    isPolling: Boolean(url && !terminal),
  };
}
