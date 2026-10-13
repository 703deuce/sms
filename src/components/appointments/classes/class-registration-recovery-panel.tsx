"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type RecoveryRow = {
  id: string;
  kind: string;
  stripeCheckoutSessionId: string | null;
  status: string;
  recovery: string | null;
  reason: string | null;
  updatedAt: string;
};

export function ClassRegistrationRecoveryPanel() {
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/service-booking/registration-recovery");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load recovery queue");
      setRows(json.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(sessionId: string | null, rowId: string) {
    if (!sessionId) return;
    setBusyId(rowId);
    setMessage(null);
    try {
      const res = await fetch("/api/appointments/service-booking/registration-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeCheckoutSessionId: sessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      setMessage("Retry submitted. Refresh the list if enrollment still pending.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || rows.length === 0) return null;

  return (
    <section
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm"
      aria-label="Paid registration recovery"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-amber-950">
            Paid registration needs attention ({rows.length})
          </p>
          <p className="text-amber-900/80">
            These customers may have paid but are not fully enrolled. Retry fulfillment after fixing
            capacity or configuration — refunds are not automatic.
          </p>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-amber-950 truncate">
                    {row.stripeCheckoutSessionId || row.id}
                  </p>
                  <p className="text-xs text-amber-900/70">
                    {row.recovery || row.status}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </p>
                </div>
                {row.stripeCheckoutSessionId ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50 disabled:opacity-50"
                    disabled={busyId === row.id}
                    onClick={() => void retry(row.stripeCheckoutSessionId, row.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Retry enrollment
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {message ? <p className="text-xs text-amber-900" role="status">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
