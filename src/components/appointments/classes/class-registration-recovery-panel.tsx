"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Callout, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

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
    <Callout
      tone="warning"
      title={`Paid registration needs attention (${rows.length})`}
      className="mb-6"
    >
      <p className="text-sm text-muted-foreground">
        These customers may have paid but are not fully enrolled. Retry fulfillment after fixing
        capacity or configuration — refunds are not automatic.
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className={`${OPUS_CARD} flex flex-wrap items-center justify-between gap-3 p-3`}>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs">{row.stripeCheckoutSessionId || row.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Pill tone="neutral" dot={false} className="mr-2 inline-flex text-xs">
                  {row.recovery || row.status}
                </Pill>
                {row.reason || ""}
              </p>
            </div>
            {row.stripeCheckoutSessionId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyId === row.id}
                onClick={() => void retry(row.stripeCheckoutSessionId, row.id)}
              >
                <RefreshCw className="mr-2 size-3.5" aria-hidden />
                Retry enrollment
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? <p className="mt-3 text-xs" role="status">{message}</p> : null}
    </Callout>
  );
}
