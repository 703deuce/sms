"use client";

import { useState } from "react";

export function VerifyJobActions({ jobId, failedCount }: { jobId: string; failedCount: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function retryFailed() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/verify/jobs/${jobId}/retry-failed`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setMessage(`Retrying ${json.data.retried} failed row(s).`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteJob() {
    const ok = window.confirm("Delete this job and its stored results? This cannot be undone.");
    if (!ok) return;
    setLoading(true);
    await fetch(`/api/verify/jobs/${jobId}/delete`, { method: "DELETE" });
    window.location.href = "/verify/jobs";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {failedCount > 0 ? (
        <button
          type="button"
          disabled={loading}
          onClick={retryFailed}
          className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Retry failed rows
        </button>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={deleteJob}
        className="rounded-md border px-3 py-1.5 text-sm font-medium text-destructive disabled:opacity-50"
      >
        Delete job
      </button>
      {message ? <p className="w-full text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
