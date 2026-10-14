"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { rep } from "@/components/reputation/rep-ui";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import { cn } from "@/lib/utils";

type SyncJob = {
  kind: string;
  jobId: string;
  queued: boolean;
  skipped?: string;
};

type SyncResponse = {
  queued?: boolean;
  status?: string;
  message?: string;
  error?: string;
  jobs?: SyncJob[];
};

type JobStatusResponse = {
  status?: string;
  phase?: string;
  errorMessage?: string | null;
  jobType?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  review_momentum_run: "Review data",
  reputation_audit: "Reputation audit",
};

async function waitForJob(jobId: string, onTick?: (label: string) => void): Promise<void> {
  const started = Date.now();
  let delay = 2000;
  while (Date.now() - started < 12 * 60_000) {
    const res = await fetch(`/api/jobs/${jobId}/status`, { cache: "no-store" });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (res.status === 404) {
      // Enqueue race — keep waiting briefly.
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay + 500, 5000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Could not check sync status (HTTP ${res.status})`);
    }
    const json = (await res.json()) as JobStatusResponse;
    const status = String(json.status ?? "");
    onTick?.(
      json.jobType
        ? `${KIND_LABEL[json.jobType] ?? json.jobType}: ${json.phase ?? status}`
        : status
    );
    if (isTerminalJobStatus(status)) {
      if (status !== "completed" && status !== "complete") {
        throw new Error(json.errorMessage ?? `Sync job ended with status ${status}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, 6000);
  }
  throw new Error("Sync is taking longer than expected. Refresh the page in a minute.");
}

export function ReputationSyncButton({
  businessId,
  className,
  label = "Refresh Reputation Data",
  variant = "primary",
  onQueued,
  onComplete,
  reloadOnComplete = true,
}: {
  businessId: string;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary";
  onQueued?: () => void;
  onComplete?: () => void;
  /** Soft-refresh the route after both jobs finish so charts refill. */
  reloadOnComplete?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      setMessage("Starting reputation sync…");
      const res = await fetch("/api/reputation/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, forceRefresh: true }),
      });
      const json = (await res.json()) as SyncResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to queue reputation sync");
      }

      if (json.status === "preview") {
        setMessage(json.message ?? "Preview sync acknowledged.");
        onQueued?.();
        onComplete?.();
        return;
      }

      const jobs = (json.jobs ?? []).filter((job) => job.queued && job.jobId);
      if (!jobs.length) {
        throw new Error(json.message ?? "No sync jobs were queued");
      }

      onQueued?.();
      setMessage(`Queued ${jobs.length} jobs — waiting for background workers…`);

      for (const [index, job] of jobs.entries()) {
        const labelForKind = KIND_LABEL[job.kind] ?? job.kind;
        setMessage(`Running ${labelForKind} (${index + 1}/${jobs.length})…`);
        await waitForJob(job.jobId, (tick) => {
          setMessage(`Running ${labelForKind} (${index + 1}/${jobs.length}) — ${tick}`);
        });
      }

      setMessage("Sync finished. Updating pages…");
      onComplete?.();
      if (reloadOnComplete) {
        router.refresh();
      }
      setMessage("Reputation data refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reputation sync");
    } finally {
      setRunning(false);
    }
  }, [businessId, onComplete, onQueued, reloadOnComplete, router]);

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void runSync()}
        disabled={running}
        className={cn(
          variant === "primary" ? rep.btnPrimary : rep.btnSecondary,
          "disabled:opacity-60"
        )}
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {running ? "Syncing…" : label}
      </button>
      {message ? <p className="max-w-md text-xs font-medium text-[#027A48]">{message}</p> : null}
      {error ? <p className="max-w-md text-xs font-medium text-[#B42318]">{error}</p> : null}
    </div>
  );
}

export function ReputationEmptySyncState({
  businessId,
  title,
  description,
}: {
  businessId: string;
  title: string;
  description: string;
}) {
  return (
    <div className={cn(rep.card, "flex flex-col items-center gap-4 px-6 py-16 text-center")}>
      <div>
        <h2 className="text-lg font-semibold text-[#101828]">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-[#667085]">{description}</p>
      </div>
      <ReputationSyncButton businessId={businessId} />
    </div>
  );
}
