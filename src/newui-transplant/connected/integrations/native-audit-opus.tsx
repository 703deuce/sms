"use client";

import { useEffect, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

export function NativeAuditOpus() {
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
    <div className="space-y-4">
      <Panel
        title="Integration action audit"
        description="Every human, AI, automation, and API integration action with approvals, policy, and undo metadata."
      >
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/integrations/native" variant="outline">← Native integrations</ButtonLink>
          <Button type="button" variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>
      </Panel>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Panel title="Operational alerts">
        <ul className="space-y-2 text-sm">
          {alerts.map((a) => (
            <li key={String(a.id)} className="flex flex-wrap items-center gap-2">
              <Pill tone="warning">{String(a.severity || "warn")}</Pill>
              <span>{String(a.provider || "system")}</span>
              <span>{String(a.message)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
              </Button>
            </li>
          ))}
          {!alerts.length ? <li className="text-muted-foreground">No open alerts</li> : null}
        </ul>
      </Panel>

      <Panel title="Filter logs">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Provider"
            value={filters.provider}
            onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value }))}
          />
          <Input
            placeholder="Source"
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
          />
          <Input
            placeholder="Status"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          />
          <Button type="button" variant="outline" size="sm" onClick={load}>Apply filters</Button>
        </div>
      </Panel>

      {logs.map((l) => (
        <Panel key={String(l.id)}>
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral">{String(l.provider)}</Pill>
            <Pill tone="neutral">{String(l.source)}</Pill>
            <Pill tone="neutral">{String(l.result)}</Pill>
            <span className="text-sm">risk {String(l.riskLevel)}</span>
          </div>
          <p className="mt-2 text-sm font-medium">{String(l.actionId)}</p>
          <p className="text-xs text-muted-foreground">
            {l.createdAt ? new Date(String(l.createdAt)).toLocaleString() : ""}
            {l.reversible ? " · reversible" : " · This cannot be automatically undone."}
            {l.failureReason ? ` · ${String(l.failureReason)}` : ""}
          </p>
        </Panel>
      ))}
      {!logs.length ? (
        <Panel><p className="text-sm text-muted-foreground">No action logs yet.</p></Panel>
      ) : null}
    </div>
  );
}
