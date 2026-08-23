"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import {
  isTerminalJobStatus,
  type LightweightJobStatus,
} from "@/lib/jobs/active-job-status";

type RunResult = {
  queued?: boolean;
  jobId?: string;
  status?: string;
  [key: string]: unknown;
};

type SettleInfo = {
  ok: boolean;
  jobId: string | null;
  status: LightweightJobStatus | null;
  /** Present when the run completed synchronously (not queued). */
  syncResult?: RunResult;
};

type Options = {
  /** Called after a terminal job status (or sync completion). */
  onSettled?: (info: SettleInfo) => void | Promise<void>;
};

/**
 * Shared pattern for module dashboards:
 * 1. POST a run endpoint that returns { queued, jobId }
 * 2. Poll lightweight /api/jobs/[jobId]/status while active
 * 3. Reload module data once when the job settles
 */
export function useModuleJobRunner(options: Options = {}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSettledRef = useRef(options.onSettled);
  onSettledRef.current = options.onSettled;

  const { status, error: pollError, isPolling } = useActiveJobStatus({
    statusUrl: jobId ? `/api/jobs/${jobId}/status` : null,
    enabled: Boolean(jobId),
  });

  useEffect(() => {
    if (!jobId || !status) return;
    if (!isTerminalJobStatus(status.status)) return;

    const ok = status.status === "completed" || status.status === "complete";
    if (!ok) {
      setError(status.errorMessage ?? "Job failed");
    }
    setRunning(false);
    const settledJobId = jobId;
    void Promise.resolve(
      onSettledRef.current?.({
        ok,
        jobId: settledJobId,
        status,
      })
    ).finally(() => {
      setJobId(null);
    });
  }, [jobId, status]);

  useEffect(() => {
    if (pollError) setError(pollError);
  }, [pollError]);

  const start = useCallback(async (url: string, body: Record<string, unknown>, failMessage = "Run failed") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 404
            ? `Run API not found (${url}). Redeploy the web app so this route exists.`
            : res.status === 403
              ? "Request blocked by security (invalid origin). confirm APP_URL matches your public host."
              : `${failMessage} (HTTP ${res.status})`
        );
      }
      const json = (await res.json()) as RunResult & { error?: string; code?: string };
      if (!res.ok) {
        if (res.status === 403 && /invalid origin/i.test(String(json.error ?? ""))) {
          throw new Error(
            "Request blocked by security (invalid origin). confirm APP_URL matches your public host."
          );
        }
        if (
          res.status === 404 ||
          json.code === "org_lookup_failed" ||
          /organization/i.test(String(json.error ?? ""))
        ) {
          throw new Error(
            json.error ??
              "Could not start this job (security/org check failed). The worker never received it — check Coolify DB migrations and APP_URL, then retry."
          );
        }
        throw new Error(json.error ?? failMessage);
      }

      if (json.queued && typeof json.jobId === "string") {
        setJobId(json.jobId);
        return json;
      }

      await onSettledRef.current?.({
        ok: true,
        jobId: typeof json.jobId === "string" ? json.jobId : null,
        status: null,
        syncResult: json,
      });
      setRunning(false);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : failMessage);
      setRunning(false);
      throw e;
    }
  }, []);

  return {
    start,
    running: running || isPolling,
    error,
    setError,
    jobId,
    jobStatus: status,
  };
}
