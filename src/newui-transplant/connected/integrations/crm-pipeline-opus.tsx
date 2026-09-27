"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";

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

export function CrmPipelineOpus() {
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
    <div className="space-y-4">
      <Panel
        title="CRM pipeline board"
        description="Read-focused view of synced deals grouped by pipeline and stage."
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ButtonLink href="/integrations/crm" variant="outline">CRM integrations</ButtonLink>
          <div className="flex flex-wrap gap-2">
            {["", "salesforce", "zoho", "pipedrive"].map((p) => (
              <Button
                key={p || "all"}
                type="button"
                size="sm"
                variant={providerFilter === p ? "default" : "outline"}
                onClick={() => setProviderFilter(p)}
              >
                {p || "All providers"}
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <Panel><p className="text-sm text-muted-foreground">Loading deals…</p></Panel>
      ) : !pipelines.length ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No synced deals yet. Connect a CRM and run sync to populate this board.
          </p>
        </Panel>
      ) : (
        <p className="text-sm text-muted-foreground">
          {totalDeals} deal(s) across {pipelines.length} pipeline(s)
          {refreshing ? " · refreshing…" : ""}
        </p>
      )}

      {pipelines.map((pipeline) => (
        <Panel
          key={`${pipeline.provider}-${pipeline.pipelineId || pipeline.pipelineName}`}
          title={pipeline.pipelineName}
          description={`${pipeline.dealCount} deals`}
        >
          {pipeline.provider ? <Pill tone="neutral">{pipeline.provider}</Pill> : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {pipeline.stages.map((stage) => (
              <Panel
                key={`${stage.stageId || stage.stageName}`}
                title={stage.stageName}
                description={`${stage.deals.length} deals`}
              >
                <ul className="space-y-2">
                  {stage.deals.map((deal) => {
                    const stages = (stagesByProvider[deal.provider] || []).filter(
                      (s) => !s.pipelineId || s.pipelineId === deal.pipelineId,
                    );
                    const writable = Boolean(writableByProvider[deal.provider]);
                    return (
                      <li key={deal.id} className="rounded-lg border border-border p-2.5 text-sm space-y-1.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">{deal.name}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Pill tone="neutral">{deal.syncStatus}</Pill>
                            {deal.externalUrl ? (
                              <a href={deal.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                Open in CRM
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {deal.contactId ? (
                            <Link href={`/contacts/${deal.contactId}`} className="text-primary hover:underline">
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
                            {deal.nextTask.dueAt ? ` (${new Date(deal.nextTask.dueAt).toLocaleDateString()})` : ""}
                          </p>
                        ) : null}
                        {deal.upcomingAppointmentAt ? (
                          <p className="text-xs text-muted-foreground">
                            Upcoming Calendly: {new Date(deal.upcomingAppointmentAt).toLocaleString()}
                          </p>
                        ) : null}
                        {writable && stages.length ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Move to</span>
                            <Select
                              disabled={busyDeal === deal.externalId}
                              onValueChange={(id) => {
                                if (id) moveDeal(deal, id);
                              }}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Stage…" />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Read-only · move stages in CRM</p>
                        )}
                      </li>
                    );
                  })}
                  {!stage.deals.length ? (
                    <li className="text-xs text-muted-foreground">No deals in this stage</li>
                  ) : null}
                </ul>
              </Panel>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
