"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Code2,
  MoreHorizontal,
  PlugZap,
  Plus,
  Search,
  Settings,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { WebhooksClient } from "@/components/integrations/webhooks-client";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import type { ReputationAutomationPreviewData } from "@/lib/reputation/reputation-page-preview-data";
import { cn } from "@/lib/utils";

type AutomationTab = "triggers" | "integrations" | "activity" | "history";

type EndpointRow = {
  id: string;
  name: string;
  eventType: string;
  isActive: boolean;
  isTest: boolean;
  lastReceivedAt: string | null;
  campaignId?: string | null;
};

type Metrics = {
  active?: number;
  eventsThisMonth?: number;
  successful?: number;
  failed?: number;
};

type AutomationMetrics = Partial<ReputationAutomationPreviewData["metrics"]> & {
  active: number;
  fired30d?: number;
  enrolled?: number;
  reviewsGenerated?: number;
  successPct?: number;
};

type TriggerRow = ReputationAutomationPreviewData["triggers"][number];
type ActivityRow = ReputationAutomationPreviewData["activities"][number];
type IntegrationRow = ReputationAutomationPreviewData["integrations"][number];

const TABS: Array<{ id: AutomationTab; label: string }> = [
  { id: "triggers", label: "Triggers" },
  { id: "integrations", label: "Integrations" },
  { id: "activity", label: "Activity Log" },
  { id: "history", label: "Workflow History" },
];

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: TriggerRow["status"]): "green" | "amber" | "gray" {
  if (status === "Active") return "green";
  if (status === "Paused") return "amber";
  if (status === "Test") return "amber";
  return "gray";
}

function IntegrationCard({
  item,
  onConfigure,
}: {
  item: IntegrationRow;
  onConfigure: () => void;
}) {
  const n = item.name.toLowerCase();
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          {n.includes("zapier") ? <Zap className="h-5 w-5" />
            : n.includes("webhook") || n.includes("generic") ? <Webhook className="h-5 w-5" />
              : n.includes("api") ? <Code2 className="h-5 w-5" />
                : <PlugZap className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#101828]">{item.name}</h3>
            <RepBadge tone={item.status === "Connected" ? "green" : "gray"}>{item.status}</RepBadge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[#667085]">{item.detail}</p>
          <button type="button" onClick={onConfigure} className={cn(rep.btnSecondary, "mt-4")}>
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Recent Activity</h2>
        <Activity className="h-4 w-4 text-[#98A2B3]" />
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[#D0D5DD] px-3 py-6 text-center text-sm text-[#667085]">
          No webhook activity has been received yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-3">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  row.tone === "red" ? "bg-[#D92D20]" : row.tone === "amber" ? "bg-[#F79009]" : "bg-[#137752]"
                )}
              />
              <div>
                <p className="text-sm font-medium text-[#101828]">{row.title}</p>
                <p className="text-xs text-[#667085]">{row.detail}</p>
                <p className="mt-1 text-xs text-[#98A2B3]">{row.at}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConnectedIntegrations({ rows }: { rows: IntegrationRow[] }) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <h2 className="text-sm font-semibold text-[#101828]">Connected Integrations</h2>
      <div className="mt-3 space-y-2">
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#101828]">{item.name}</p>
              <p className="text-xs text-[#667085]">{item.detail}</p>
            </div>
            <RepBadge tone={item.status === "Connected" ? "green" : "gray"}>{item.status}</RepBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowHistoryTable({ triggers }: { triggers: TriggerRow[] }) {
  return (
    <div className={cn(rep.card, "overflow-hidden")}>
      <div className="border-b border-[#E6EAF0] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#101828]">Workflow History</h2>
        <p className="text-xs text-[#667085]">Recent automation run history and enrollment counts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
            <tr>
              <th className="min-w-[220px] px-4 py-3 font-semibold">Workflow</th>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Last Run</th>
              <th className="px-4 py-3 text-right font-semibold">Enrolled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {triggers.map((trigger) => (
              <tr key={trigger.id} className="bg-white hover:bg-[#F9FAFB]">
                <td className="px-4 py-3 font-semibold text-[#101828]">{trigger.name}</td>
                <td className="px-4 py-3 text-[#344054]">{trigger.campaign}</td>
                <td className="px-4 py-3">
                  <RepBadge tone={statusTone(trigger.status)}>{trigger.status}</RepBadge>
                </td>
                <td className="px-4 py-3 text-[#667085]">{fmtDateTime(trigger.lastFired)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#344054]">{trigger.enrolled.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AutomationsHub({
  businessId,
  previewData,
}: {
  businessId: string;
  previewData?: ReputationAutomationPreviewData;
}) {
  const [activeTab, setActiveTab] = useState<AutomationTab>("triggers");
  const [triggers, setTriggers] = useState<TriggerRow[]>(previewData?.triggers ?? []);
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(previewData?.metrics ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);
  const [triggerSearch, setTriggerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (previewData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/webhooks?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load automations");
      const endpointRows = (json.endpoints ?? json.items ?? []) as EndpointRow[];
      const apiMetrics = (json.metrics ?? {}) as Metrics;
      setTriggers(
        endpointRows.map((endpoint) => ({
          id: endpoint.id,
          name: endpoint.name,
          source: endpoint.eventType,
          campaign: endpoint.campaignId ? `Campaign ${endpoint.campaignId.slice(0, 8)}` : "Mapped campaign",
          status: endpoint.isTest ? "Test" : endpoint.isActive ? "Active" : "Paused",
          lastFired: endpoint.lastReceivedAt,
          enrolled: 0,
        }))
      );
      const successful = typeof apiMetrics.successful === "number" ? apiMetrics.successful : undefined;
      const failed = typeof apiMetrics.failed === "number" ? apiMetrics.failed : undefined;
      const total = successful != null && failed != null ? successful + failed : null;
      setMetrics({
        active: Number(apiMetrics.active ?? endpointRows.filter((endpoint) => endpoint.isActive).length),
        fired30d: typeof apiMetrics.eventsThisMonth === "number" ? apiMetrics.eventsThisMonth : undefined,
        successPct: total && total > 0 && successful != null ? Math.round((successful / total) * 1000) / 10 : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, previewData]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const activities = previewData?.activities ?? [];
  const integrations: IntegrationRow[] =
    previewData?.integrations ??
    [
      { id: "zapier", name: "Zapier", status: "Available", detail: "Use Webhooks by Zapier to POST completed jobs." },
      { id: "generic", name: "Generic webhook", status: triggers.length ? "Connected" : "Available", detail: "Connect Make, n8n, CRMs, schedulers, and field-service tools." },
      { id: "api", name: "API", status: "Available", detail: "Send automation events from your backend." },
    ];
  const safeMetrics: AutomationMetrics =
    metrics ??
    {
      active: triggers.filter((trigger) => trigger.status === "Active").length,
    };

  const filteredTriggers = useMemo(() => {
    const needle = triggerSearch.trim().toLowerCase();
    return triggers.filter((t) => {
      const statusMatch = statusFilter === "all" || t.status.toLowerCase() === statusFilter.toLowerCase();
      const searchMatch = !needle || [t.name, t.source, t.campaign].some((v) => v.toLowerCase().includes(needle));
      return statusMatch && searchMatch;
    });
  }, [triggers, triggerSearch, statusFilter]);

  function trendLabel(pct: number | undefined) {
    if (pct == null) return null;
    const sign = pct >= 0 ? "▲" : "▼";
    return `${sign}${Math.abs(pct)}%`;
  }

  function metricValue(value: number | undefined) {
    return value == null ? "—" : value.toLocaleString();
  }

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Automations"
        subtitle="Connect your tools and automate review request workflows."
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" onClick={() => setActiveTab("triggers")} className={rep.btnPrimary}>
              <Plus className="h-4 w-4" />
              Create Trigger
            </button>
            <button type="button" onClick={() => setActiveTab("integrations")} className={rep.btnSecondary}>
              <PlugZap className="h-4 w-4" />
              Integrations
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/settings`}
              className={rep.btnSecondary}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard
          label="Active Automations"
          value={safeMetrics.active}
          icon={Zap}
          hint={safeMetrics.activeRunning != null ? `${safeMetrics.activeRunning} running` : "Live triggers"}
        />
        <RepMetricCard
          label="Triggers Fired 30d"
          value={metricValue(safeMetrics.fired30d)}
          icon={Activity}
          trend={trendLabel(safeMetrics.fired30dTrend) ?? undefined}
          trendPositive={safeMetrics.fired30dTrend != null && safeMetrics.fired30dTrend >= 0}
          hint="vs prior period"
        />
        <RepMetricCard
          label="Contacts Enrolled"
          value={metricValue(safeMetrics.enrolled)}
          icon={Users}
          trend={trendLabel(safeMetrics.enrolledTrend) ?? undefined}
          trendPositive={safeMetrics.enrolledTrend != null && safeMetrics.enrolledTrend >= 0}
          hint="From automations"
        />
        <RepMetricCard
          label="Reviews Generated"
          value={metricValue(safeMetrics.reviewsGenerated)}
          icon={CheckCircle2}
          trend={trendLabel(safeMetrics.reviewsGeneratedTrend) ?? undefined}
          trendPositive={safeMetrics.reviewsGeneratedTrend != null && safeMetrics.reviewsGeneratedTrend >= 0}
          hint="Attributed reviews"
        />
        <RepMetricCard
          label="Automation Success"
          value={safeMetrics.successPct == null ? "—" : `${safeMetrics.successPct}%`}
          icon={Webhook}
          trend={safeMetrics.successPctDelta != null ? `${safeMetrics.successPctDelta > 0 ? "▲" : "▼"}${Math.abs(safeMetrics.successPctDelta)}%` : undefined}
          trendPositive={safeMetrics.successPctDelta == null || safeMetrics.successPctDelta >= 0}
          hint="Processed events"
        />
      </div>

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as AutomationTab)} />

      {activeTab === "triggers" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className={cn(rep.card, "overflow-hidden")}>
              <div className="border-b border-[#E6EAF0] px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-[#101828]">Automation Triggers</h2>
                    <p className="text-xs text-[#667085]">Webhook and integration events mapped into review campaigns.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className={cn(rep.select, "h-9 text-xs")}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="test">Test</option>
                    </select>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]" />
                      <input
                        type="search"
                        value={triggerSearch}
                        onChange={(e) => setTriggerSearch(e.target.value)}
                        placeholder="Search triggers..."
                        className={cn(rep.input, "h-9 pl-8 text-xs")}
                        style={{ minWidth: 160 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label="Select all triggers" />
                      </th>
                      <th className="min-w-[200px] px-4 py-3 font-semibold">Trigger</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="min-w-[200px] px-4 py-3 font-semibold">Campaign</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Last Fired</th>
                      <th className="px-4 py-3 text-right font-semibold">Enrolled</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {filteredTriggers.map((trigger) => (
                      <tr key={trigger.id} className="bg-white hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label={`Select ${trigger.name}`} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#101828]">{trigger.name}</p>
                        </td>
                        <td className="px-4 py-3 text-[#344054]">{trigger.source}</td>
                        <td className="px-4 py-3 text-[#344054]">{trigger.campaign}</td>
                        <td className="px-4 py-3">
                          <RepBadge tone={statusTone(trigger.status)}>{trigger.status}</RepBadge>
                        </td>
                        <td className="px-4 py-3 text-[#667085]">{fmtDateTime(trigger.lastFired)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#344054]">{trigger.enrolled.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && filteredTriggers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                          No triggers match the current filters.
                        </td>
                      </tr>
                    ) : null}
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                          Loading automations...
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
            {!previewData ? (
              <div className={cn(rep.card, "p-4")}>
                <WebhooksClient businessId={businessId} embedded />
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <ActivityFeed rows={activities} />
            <ConnectedIntegrations rows={integrations} />
          </aside>
        </div>
      ) : null}

      {activeTab === "integrations" ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {integrations.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              onConfigure={() => setActiveTab("integrations")}
            />
          ))}
        </div>
      ) : null}

      {activeTab === "activity" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className={cn(rep.card, "p-4")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#101828]">Activity Log</h2>
              <Activity className="h-4 w-4 text-[#98A2B3]" />
            </div>
            <ul className="space-y-3">
              {activities.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[#D0D5DD] px-3 py-8 text-center text-sm text-[#667085]">
                  No webhook activity has been received yet.
                </li>
              ) : (
                activities.map((row) => (
                  <li key={row.id} className="flex gap-3 rounded-xl bg-[#F9FAFB] p-3">
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                        row.tone === "red" ? "bg-[#D92D20]" : row.tone === "amber" ? "bg-[#F79009]" : "bg-[#137752]"
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-[#101828]">{row.title}</p>
                      <p className="text-xs text-[#667085]">{row.detail}</p>
                      <p className="mt-1 text-xs text-[#98A2B3]">{row.at}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
          <ConnectedIntegrations rows={integrations} />
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="space-y-3">
          <WorkflowHistoryTable triggers={triggers} />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Total Runs (30d)", value: metricValue(safeMetrics.fired30d) },
              { label: "Contacts Enrolled (30d)", value: metricValue(safeMetrics.enrolled) },
              { label: "Success Rate", value: safeMetrics.successPct == null ? "—" : `${safeMetrics.successPct}%` },
            ].map((stat) => (
              <div key={stat.label} className={cn(rep.card, "p-4 text-center")}>
                <p className={rep.label}>{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#101828]">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

