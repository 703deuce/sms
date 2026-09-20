"use client";

import { fmtCallPhone } from "@/lib/voice/calls/display";
import { useCallback, useEffect, useState } from "react";

type BlockedRow = {
  id: string;
  callerE164: string;
  displayName: string | null;
  createdAt: string;
};

export function BlockedCallersManageDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/blocked-callers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load blocked callers");
      setRows(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load blocked callers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function unblock(callerE164: string) {
    setError(null);
    const res = await fetch(
      `/api/voice/blocked-callers?callerE164=${encodeURIComponent(callerE164)}`,
      { method: "DELETE" },
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not unblock caller");
      return;
    }
    await load();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-callers-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div className="border-b border-border px-4 py-3">
          <h2 id="blocked-callers-title" className="text-sm font-semibold text-foreground">
            Blocked callers
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Future calls from these numbers are rejected before Amy answers.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked callers yet.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {fmtCallPhone(row.callerE164)}
                    </p>
                    {row.displayName ? (
                      <p className="text-xs text-muted-foreground">{row.displayName}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Blocked{" "}
                      {new Date(row.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                    onClick={() => void unblock(row.callerE164)}
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
