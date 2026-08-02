"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

export function AuditClient() {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [filters, setFilters] = useState({ provider: "", source: "", status: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    const qs = new URLSearchParams();
    if (filters.provider) qs.set("provider", filters.provider);
    if (filters.source) qs.set("source", filters.source);
    if (filters.status) qs.set("status", filters.status);
    fetch(`/api/integrations/native/audit?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setLogs(j.data?.logs || []);
      })
      .catch(() => setError("Failed to load audit"));
    fetch("/api/integrations/native/audit?view=alerts&scan=1")
      .then((r) => r.json())
      .then((j) => setAlerts(j.data?.alerts || []))
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Integration action audit"
        description="Every human, AI, automation, and API integration action with approvals, policy, and undo metadata."
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
        <button type="button" className="underline" onClick={load}>
          Refresh
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <Card className="mb-6 p-4">
        <CardTitle className="text-base">Operational alerts</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {alerts.map((a) => (
            <li key={String(a.id)} className="flex flex-wrap items-center gap-2">
              <StatusChip status={String(a.severity || "warn")} />
              <span>{String(a.provider || "system")}</span>
              <span>{String(a.message)}</span>
              <button
                type="button"
                className="underline"
                onClick={async () => {
                  await fetch("/api/integrations/native/audit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ op: "ack", alertId: a.id }),
                  });
                  load();
                }}
              >
                Acknowledge
              </button>
            </li>
          ))}
          {!alerts.length ? <li className="text-muted-foreground">No open alerts</li> : null}
        </ul>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <input
          className="rounded border px-2 py-1"
          placeholder="Provider"
          value={filters.provider}
          onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value }))}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="Source"
          value={filters.source}
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
        />
        <input
          className="rounded border px-2 py-1"
          placeholder="Status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        />
        <button type="button" className="underline" onClick={load}>
          Apply filters
        </button>
      </div>

      <div className="space-y-3">
        {logs.map((l) => (
          <Card key={String(l.id)} className="p-4">
            <div className="flex flex-wrap gap-2">
              <StatusChip status={String(l.provider)} />
              <StatusChip status={String(l.source)} />
              <StatusChip status={String(l.result)} />
              <span className="text-sm">risk {String(l.riskLevel)}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{String(l.actionId)}</p>
            <p className="text-xs text-muted-foreground">
              {l.createdAt ? new Date(String(l.createdAt)).toLocaleString() : ""}
              {l.reversible ? " · reversible" : " · This cannot be automatically undone."}
              {l.failureReason ? ` · ${String(l.failureReason)}` : ""}
            </p>
          </Card>
        ))}
        {!logs.length ? <p className="text-sm text-muted-foreground">No action logs yet.</p> : null}
      </div>
    </div>
  );
}
