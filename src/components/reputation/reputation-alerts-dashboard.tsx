"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Zap,
} from "lucide-react";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import type {
  ReputationAlertRow,
  ReputationAlertsData,
  ReputationAlertSeverity,
} from "@/lib/reputation/alerts-data";
import { cn } from "@/lib/utils";

type AlertTab = "all" | "critical" | "warning" | "info" | "resolved";

const SEVERITY_TONE: Record<ReputationAlertSeverity, "red" | "amber" | "blue" | "gray"> = {
  critical: "red",
  high: "red",
  medium: "amber",
  low: "blue",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function severityGroup(severity: ReputationAlertSeverity): AlertTab {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  return "info";
}

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function alertStatusLabel(alert: ReputationAlertRow): string {
  if (alert.status === "resolved" || alert.status === "dismissed") return "Resolved";
  if (alert.source === "persisted") return "Acknowledged";
  if (alert.severity === "critical" || alert.severity === "high") return "New";
  return "In Progress";
}

function alertStatusTone(alert: ReputationAlertRow): "green" | "blue" | "amber" | "gray" {
  if (alert.status === "resolved" || alert.status === "dismissed") return "green";
  if (alert.source === "persisted" && alert.severity !== "critical") return "amber";
  return "blue";
}

function AlertStatusBadge({ alert }: { alert: ReputationAlertRow }) {
  return <RepBadge tone={alertStatusTone(alert)}>{alertStatusLabel(alert)}</RepBadge>;
}

export function ReputationAlertsDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReputationAlertsData;
}) {
  const pm = data.previewMetrics;
  const [activeTab, setActiveTab] = useState<AlertTab>("all");
  const [activeAlerts, setActiveAlerts] = useState(data.activeAlerts);
  const [resolvedAlerts, setResolvedAlerts] = useState(data.resolvedAlerts);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const allRows = useMemo(() => [...activeAlerts, ...resolvedAlerts], [activeAlerts, resolvedAlerts]);
  const categories = useMemo(
    () => Array.from(new Set(allRows.map((alert) => alert.category))).sort(),
    [allRows]
  );
  const filteredRows = useMemo(() => {
    const base = activeTab === "resolved" ? resolvedAlerts : activeAlerts;
    return base.filter((alert) => {
      const tabMatch = activeTab === "all" || activeTab === "resolved" || severityGroup(alert.severity) === activeTab;
      const categoryMatch = categoryFilter === "all" || alert.category === categoryFilter;
      // Location filter is single-business today; keep the control honest.
      const locationMatch = locationFilter === "all" || locationFilter === businessId;
      return tabMatch && categoryMatch && locationMatch;
    });
  }, [activeAlerts, activeTab, businessId, categoryFilter, locationFilter, resolvedAlerts]);

  const categoryCounts = useMemo(() => {
    return categories.map((category) => ({
      category,
      count: allRows.filter((alert) => alert.category === category).length,
    }));
  }, [allRows, categories]);

  const criticalCount = pm?.criticalCount ?? activeAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const warningCount = pm?.warningCount ?? activeAlerts.filter((a) => a.severity === "medium").length;
  const infoCount = pm?.infoCount ?? activeAlerts.filter((a) => a.severity === "low").length;
  const activeCount = pm?.activeCount ?? activeAlerts.length;
  const requiringAction = pm?.requiringAction ?? activeAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const resolved30d = pm?.resolved30d ?? resolvedAlerts.filter((alert) => {
    const resolvedAt = alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : 0;
    return resolvedAt > now - 30 * 86_400_000;
  }).length;
  const notificationsSent = pm?.notificationsSent ?? (data.preferences.email_recipients?.length ? 0 : 0);
  const alertAccuracy = pm?.alertAccuracy ?? 0;

  const TABS: Array<{ id: AlertTab; label: string }> = [
    { id: "all", label: `All Alerts (${activeCount})` },
    { id: "critical", label: `Critical (${criticalCount})` },
    { id: "warning", label: `Warning (${warningCount})` },
    { id: "info", label: `Info (${infoCount})` },
    { id: "resolved", label: "Resolved" },
  ];

  async function resolveAlert(alert: ReputationAlertRow) {
    setResolvingId(alert.id);
    try {
      await fetch("/api/reputation/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, alertId: alert.id, source: alert.source }),
      });
    } finally {
      const resolved = { ...alert, status: "resolved" as const, resolvedAt: new Date().toISOString() };
      setActiveAlerts((rows) => rows.filter((row) => row.id !== alert.id));
      setResolvedAlerts((rows) => [resolved, ...rows]);
      setResolvingId(null);
    }
  }

  const triggerCounts = useMemo(() => {
    const all = [...activeAlerts, ...resolvedAlerts];
    const counts = new Map<string, number>();
    for (const alert of all) {
      const label = categoryLabel(alert.category);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activeAlerts, resolvedAlerts]);

  const emailOn = Boolean(data.preferences.email_recipients?.length);
  const notifChannels = [
    {
      label: "Email",
      enabled: emailOn,
      detail: emailOn ? `${data.preferences.email_recipients.length} recipient(s)` : "Off",
      icon: Mail,
    },
    {
      label: "In-App",
      enabled: true,
      detail: "Dashboard alerts",
      icon: Smartphone,
    },
  ];

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Alerts"
        subtitle={`Monitor reputation risks, opportunities, and notifications for ${data.businessName}.`}
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <Link
              href={`/businesses/${businessId}/reputation/settings`}
              className={rep.btnPrimary}
            >
              <Plus className="h-4 w-4" />
              New Alert
            </Link>
            <Link
              href={`/businesses/${businessId}/reputation/settings`}
              className={rep.btnSecondary}
            >
              <Settings className="h-4 w-4" />
              Alert Settings
            </Link>
            <Link
              href={`/businesses/${businessId}/reputation/settings`}
              className={rep.btnSecondary}
            >
              <Bell className="h-4 w-4" />
              Notification Preferences
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard
          label="Active Alerts"
          value={activeCount}
          icon={AlertTriangle}
          hint={`${criticalCount} critical • ${warningCount} warning`}
        />
        <RepMetricCard
          label="Requiring Action"
          value={requiringAction}
          icon={AlertCircle}
          iconClassName="bg-[#FEF3F2] text-[#B42318]"
          hint="Critical & high severity"
        />
        <RepMetricCard
          label="Resolved (30 Days)"
          value={resolved30d}
          icon={CheckCircle2}
          hint="Recently closed"
        />
        <RepMetricCard
          label="Notifications Sent"
          value={notificationsSent || (data.preferences.email_recipients?.length ? "On" : "0")}
          icon={Mail}
          hint={data.preferences.email_recipients?.length ? `${data.preferences.email_recipients.length} recipient(s)` : "No recipients"}
        />
        <RepMetricCard
          label="Alert Accuracy"
          value={alertAccuracy ? `${alertAccuracy}%` : "—"}
          icon={ShieldCheck}
          hint="Calibrates with usage"
        />
      </div>

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as AlertTab)} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <main className="min-w-0 flex-1 space-y-3">
          <div className={cn(rep.card, "flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between")}>
            <div className="flex flex-wrap gap-2">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={rep.select}>
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className={rep.select}>
                <option value="all">All Locations</option>
                <option value={businessId}>{data.businessName}</option>
              </select>
              <button
                type="button"
                className={rep.btnSecondary}
                onClick={() => {
                  setCategoryFilter("all");
                  setLocationFilter("all");
                }}
              >
                Apply Filters
              </button>
            </div>
            <p className="text-xs text-[#667085]">
              Showing {filteredRows.length} alert{filteredRows.length === 1 ? "" : "s"} · {locationFilter === "all" ? "All locations" : data.businessName}
            </p>
          </div>

          <div className={cn(rep.card, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label="Select all alerts" />
                    </th>
                    <th className="min-w-[320px] px-4 py-3 font-semibold">Alert</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                    <th className="px-4 py-3 font-semibold">Triggered</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {filteredRows.map((alert) => (
                    <tr key={alert.id} className="bg-white hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label={`Select ${alert.title}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            "mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg",
                            alert.severity === "critical" || alert.severity === "high"
                              ? "bg-[#FEF3F2] text-[#B42318]"
                              : alert.severity === "medium"
                                ? "bg-[#FFFAEB] text-[#B54708]"
                                : "bg-[#EFF8FF] text-[#175CD3]"
                          )}>
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-[#101828]">{alert.title}</p>
                            {alert.body ? <p className="mt-1 line-clamp-2 max-w-xl text-xs text-[#667085]">{alert.body}</p> : null}
                            <p className="mt-1 text-xs text-[#98A2B3]">{categoryLabel(alert.category)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RepBadge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</RepBadge>
                      </td>
                      <td className="px-4 py-3 text-[#667085]">{fmtDate(alert.createdAt)}</td>
                      <td className="px-4 py-3"><AlertStatusBadge alert={alert} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {alert.status === "active" ? (
                            <button
                              type="button"
                              disabled={resolvingId === alert.id}
                              onClick={() => void resolveAlert(alert)}
                              className="text-xs font-semibold text-[#137752] hover:underline disabled:opacity-60"
                            >
                              {resolvingId === alert.id ? "Resolving..." : "Resolve"}
                            </button>
                          ) : (
                            <span className="text-xs text-[#98A2B3]">Closed</span>
                          )}
                          <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#667085]">
                        No alerts match the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="w-full space-y-3 lg:w-[340px]">
          <div className={cn(rep.card, "p-4")}>
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Alert Categories</h2>
            <div className="space-y-2">
              {categoryCounts.slice(0, 8).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setCategoryFilter(item.category === categoryFilter ? "all" : item.category)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition",
                    item.category === categoryFilter ? "bg-[#ECFDF3]" : "bg-[#F9FAFB] hover:bg-[#F2F4F7]"
                  )}
                >
                  <span className="text-sm text-[#344054]">{categoryLabel(item.category)}</span>
                  <span className="text-sm font-semibold text-[#101828]">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={cn(rep.card, "p-4")}>
            <h2 className="text-sm font-semibold text-[#101828]">Severity Guide</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="font-semibold text-[#B42318]">Critical:</span> <span className="text-[#667085]">Immediate reputation or customer risk.</span></p>
              <p><span className="font-semibold text-[#B54708]">Warning:</span> <span className="text-[#667085]">Trend needs attention this week.</span></p>
              <p><span className="font-semibold text-[#175CD3]">Info:</span> <span className="text-[#667085]">Monitor or tune settings.</span></p>
            </div>
          </div>
          <div className="rounded-xl border border-[#B7E4CC] bg-[#ECFDF3] p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 shrink-0 text-[#137752]" />
              <p className="text-sm text-[#344054]">
                <span className="font-semibold">Smart tip:</span> resolve unanswered negative reviews first — they affect conversion and Maps trust fastest.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Common Triggers</h2>
          <div className="mt-3 space-y-2">
            {triggerCounts.length === 0 ? (
              <p className="text-sm text-[#667085]">No alert history yet for this location.</p>
            ) : (
              triggerCounts.map((trigger) => (
                <div key={trigger.label} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#98A2B3]" />
                    <span className="text-sm text-[#344054]">{trigger.label}</span>
                  </div>
                  <RepBadge tone="blue">{trigger.count}</RepBadge>
                </div>
              ))
            )}
          </div>
        </div>
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Notification Channels</h2>
          <div className="mt-4 space-y-3">
            {notifChannels.map((channel) => (
              <div key={channel.label} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2 text-[#344054]">
                  <channel.icon className="h-4 w-4 text-[#98A2B3]" />
                  {channel.label}
                </span>
                <RepBadge tone={channel.enabled ? "green" : "gray"}>{channel.detail}</RepBadge>
              </div>
            ))}
          </div>
          <Link
            href={`/businesses/${businessId}/reputation/settings`}
            className={cn(rep.btnSecondary, "mt-4 w-full")}
          >
            Manage notification settings
          </Link>
        </div>
        <div className={cn(rep.card, "p-4")}>
          <h2 className="text-sm font-semibold text-[#101828]">Recommended Actions</h2>
          <div className="mt-3 space-y-2">
            {[
              {
                label: "Respond Now",
                href: `/businesses/${businessId}/reputation/reviews`,
                copy:
                  activeAlerts.find((a) => a.category === "unanswered_negative")?.recommendedAction ??
                  "Reply to unanswered negative reviews.",
              },
              {
                label: "Send Requests",
                href: `/businesses/${businessId}/reputation/requests`,
                copy: "Launch a review request cohort for recent completed jobs.",
              },
              {
                label: "View Competitors",
                href: `/businesses/${businessId}/reputation/competitors`,
                copy: "Check competitor velocity and review gaps.",
              },
            ].map((item) => (
              <div key={item.href} className="rounded-lg bg-[#F9FAFB] p-3">
                <p className="text-sm font-medium text-[#101828]">{item.copy}</p>
                <Link href={item.href} className={cn(rep.btnSecondary, "mt-2 h-8 px-3 text-xs font-semibold")}>
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
