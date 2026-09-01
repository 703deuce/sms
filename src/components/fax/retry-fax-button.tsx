"use client";

import { useState } from "react";

export function RetryFaxButton({ faxId }: { faxId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/fax/${faxId}/retry`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setStatus("Fax queued for delivery.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Retrying…" : "Try Again"}
      </button>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
