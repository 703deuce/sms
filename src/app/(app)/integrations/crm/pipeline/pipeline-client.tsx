"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PipelineDeal = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  externalUrl: string | null;
  name: string;
  owner: string | null;
  status: string | null;
  company: string | null;
  pipelineId: string | null;
  pipeline: string | null;
  stageId: string | null;
  stage: string | null;
  dealValue: number | null;
  currency: string | null;
  contactId: string | null;
  contactName: string | null;
  lastActivityAt: string | null;
  nextTask: { title: string; dueAt: string | null } | null;
  upcomingAppointmentAt: string | null;
  upcomingAppointmentName: string | null;
  lastSyncedAt: string | null;
  syncStatus: string;
};

type PipelineStage = {
  stageId: string | null;
  stageName: string;
  deals: PipelineDeal[];
};

type PipelineGroup = {
  pipelineId: string | null;
  pipelineName: string;
  provider: string | null;
  stages: PipelineStage[];
  dealCount: number;
};

type StageOption = { id: string; name: string; pipelineId?: string | null };

function formatMoney(value: number | null, currency: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function PipelineClient() {
  const [pipelines, setPipelines] = useState<PipelineGroup[]>([]);
  const [stagesByProvider, setStagesByProvider] = useState<Record<string, StageOption[]>>({});
  const [writableByProvider, setWritableByProvider] = useState<Record<string, boolean>>({});
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDeal, setBusyDeal] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPipeline = useCallback(() => {
    const qs = providerFilter ? `?provider=${encodeURIComponent(providerFilter)}` : "";
    return fetch(`/api/integrations/crm/pipeline${qs}`).then((r) => r.json());
  }, [providerFilter]);

  const applyResult = useCallback((j: { error?: string; data?: Record<string, unknown> }) => {
    if (j.error) {
      setError(j.error);
      return;
    }
    setError(null);
    setPipelines((j.data?.pipelines as PipelineGroup[]) || []);
    setStagesByProvider((j.data?.stagesByProvider as Record<string, StageOption[]>) || {});
    setWritableByProvider((j.data?.writableByProvider as Record<string, boolean>) || {});
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      applyResult(await fetchPipeline());
    } catch {
      setError("Failed to load pipeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPipeline, applyResult]);

  useEffect(() => {
    let active = true;
    fetchPipeline()
      .then((j) => {
        if (active) applyResult(j);
      })
      .catch(() => {
        if (active) setError("Failed to load pipeline");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchPipeline, applyResult]);

  const totalDeals = useMemo(
    () => pipelines.reduce((n, p) => n + p.dealCount, 0),
    [pipelines],
  );

  async function moveDeal(deal: PipelineDeal, stageId: string) {
    setBusyDeal(deal.externalId);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/crm/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: deal.provider,
          externalId: deal.externalId,
          stageId,
          pipelineId: deal.pipelineId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(json.error || "Stage update failed");
      else {
        setMessage("Deal stage updated");
        load();
      }
    } catch {
      setMessage("Stage update failed");
    } finally {
      setBusyDeal(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="CRM pipeline board"
        description="Read-focused view of synced deals grouped by pipeline and stage. Open records in your CRM or move stages when permitted."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/integrations/crm" className="underline">CRM integrations</Link>
        <div className="ml-auto flex flex-wrap gap-2">
          {["", "salesforce", "zoho", "pipedrive"].map((p) => (
            <button
              key={p || "all"}
              type="button"
              className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${
                providerFilter === p ? "border-primary bg-muted" : "border-border"
              }`}
              onClick={() => setProviderFilter(p)}
            >
              {p || "All providers"}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading deals…</p>
      ) : !pipelines.length ? (
        <p className="text-sm text-muted-foreground">
          No synced deals yet. Connect a CRM and run sync to populate this board.
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          {totalDeals} deal(s) across {pipelines.length} pipeline(s)
          {refreshing ? " · refreshing…" : ""}
        </p>
      )}

      <div className="space-y-8">
        {pipelines.map((pipeline) => (
          <section key={`${pipeline.provider}-${pipeline.pipelineId || pipeline.pipelineName}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{pipeline.pipelineName}</h2>
              {pipeline.provider ? <StatusChip status={pipeline.provider} /> : null}
              <span className="text-sm text-muted-foreground">{pipeline.dealCount} deals</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {pipeline.stages.map((stage) => (
                <Card key={`${stage.stageId || stage.stageName}`} className="p-3">
                  <CardTitle className="text-sm font-medium">
                    {stage.stageName}
                    <span className="ml-2 text-muted-foreground font-normal">
                      ({stage.deals.length})
                    </span>
                  </CardTitle>
                  <ul className="mt-3 space-y-2">
                    {stage.deals.map((deal) => {
                      const stages = (stagesByProvider[deal.provider] || []).filter(
                        (s) =>
                          !s.pipelineId || s.pipelineId === deal.pipelineId,
                      );
                      const writable = Boolean(writableByProvider[deal.provider]);
                      return (
                        <li
                          key={deal.id}
                          className="rounded-lg border border-border p-2.5 text-sm space-y-1.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-medium">{deal.name}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <StatusChip status={deal.syncStatus} />
                              {deal.externalUrl ? (
                                <a
                                  href={deal.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs underline"
                                >
                                  Open in CRM
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {deal.contactId ? (
                              <Link
                                href={`/contacts/${deal.contactId}`}
                                className="underline"
                              >
                                {deal.contactName || "Contact"}
                              </Link>
                            ) : (
                              deal.contactName || "No contact"
                            )}
                            {deal.company ? ` · ${deal.company}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deal.owner ? `Owner: ${deal.owner}` : "No owner"}
                          </p>
                          <p className="text-xs">
                            Value: {formatMoney(deal.dealValue, deal.currency)}
                            {deal.status ? ` · ${deal.status}` : ""}
                          </p>
                          {deal.nextTask ? (
                            <p className="text-xs text-muted-foreground">
                              Next task: {deal.nextTask.title}
                              {deal.nextTask.dueAt
                                ? ` (${new Date(deal.nextTask.dueAt).toLocaleDateString()})`
                                : ""}
                            </p>
                          ) : null}
                          {deal.upcomingAppointmentAt ? (
                            <p className="text-xs text-muted-foreground">
                              Upcoming Calendly:{" "}
                              {new Date(deal.upcomingAppointmentAt).toLocaleString()}
                            </p>
                          ) : null}
                          {deal.lastActivityAt ? (
                            <p className="text-xs text-muted-foreground">
                              Last activity:{" "}
                              {new Date(deal.lastActivityAt).toLocaleDateString()}
                            </p>
                          ) : null}
                          {writable && stages.length ? (
                            <label className="flex items-center gap-1.5 text-xs">
                              <span className="text-muted-foreground">Move to</span>
                              <select
                                className="rounded border border-border bg-background px-1.5 py-0.5"
                                defaultValue=""
                                disabled={busyDeal === deal.externalId}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  if (id) moveDeal(deal, id);
                                  e.target.value = "";
                                }}
                              >
                                <option value="" disabled>Stage…</option>
                                {stages.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Read-only · move stages in CRM
                            </p>
                          )}
                        </li>
                      );
                    })}
                    {!stage.deals.length ? (
                      <li className="text-xs text-muted-foreground">No deals in this stage</li>
                    ) : null}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
