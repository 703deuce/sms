"use client";

import { useState } from "react";

export function FaxDetailActions({
  faxId,
  direction,
  fromE164,
  canDownloadConfirmation,
}: {
  faxId: string;
  direction: string;
  fromE164?: string | null;
  canDownloadConfirmation: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function markSpam(isSpam: boolean, blockSender = false) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/fax/${faxId}/spam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSpam, blockSender }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setStatus(isSpam ? "Marked as spam." : "Moved back to inbox.");
      window.location.reload();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function blockSender() {
    if (!fromE164) return;
    const ok = window.confirm(`Block faxes from ${fromE164}?`);
    if (!ok) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/fax/${faxId}/block-sender`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Block failed");
      setStatus(`Blocked ${fromE164}. Future faxes from this sender will skip AI processing.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Block failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canDownloadConfirmation ? (
        <a
          href={`/api/fax/${faxId}/delivery-confirmation`}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Download delivery confirmation
        </a>
      ) : null}
      {direction === "inbound" ? (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => markSpam(true, false)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Mark as spam
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => markSpam(false)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Not spam
          </button>
          {fromE164 ? (
            <button
              type="button"
              disabled={loading}
              onClick={blockSender}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Block sender
            </button>
          ) : null}
        </>
      ) : null}
      {status ? <p className="w-full text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
