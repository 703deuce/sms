"use client";

import {
  SrMetricCard,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import { OverviewStatusSection } from "@/components/smart-routing/overview-status-section";
import { CloseNowControl } from "@/components/smart-routing/close-now-control";
import {
  derivePrimaryDestination,
  FLOW_TYPE_LABELS,
  fmtPhoneDisplay,
  fmtRelativeTime,
} from "@/lib/smart-routing/display";
import {
  shouldUseWireframeOverview,
  WIREFRAME_DEMO_FLOWS,
  WIREFRAME_OVERVIEW_METRICS,
  type WireframeFlowRow,
} from "@/lib/smart-routing/wireframe-demo";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  GitBranch,
  Grid3x3,
  MessageSquare,
  MoreHorizontal,
  Network,
  Pencil,
  Phone,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type FlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  todayCalls?: number;
  assignedPhoneNumberId?: string | null;
  businessNumberE164?: string | null;
  draftConfigJson?: DraftConfig;
};

type Metrics = {
  activeFlows: number;
  routedToday: number;
  recovered: number;
  failures: number;
};

type WorkspaceStatus = {
  publicBusinessE164: string | null;
  routingNumberE164: string | null;
  callerIdStatus: string;
  authorizedCallerCount: number;
  outboundBusinessCallbacks?: number;
  primaryFlow?: { id: string; name: string; status: string; type: string } | null;
  readiness: import("@/lib/smart-routing/setup-readiness").SetupReadiness;
  scheduleOverride?: { mode?: string; expiresAt?: string } | null;
};

type Template = {
  type: string;
  title: string;
  subtitle: string;
  bestFor: string[];
};

const FLOW_ICONS: Record<string, typeof Grid3x3> = {
  phone_menu: Grid3x3,
  missed_call_recovery: MessageSquare,
  after_hours: Clock,
  department: Users,
  custom: Network,
};

const STATUS_FILTERS = ["all", "active", "draft", "paused"] as const;

type TableRow = FlowRow | WireframeFlowRow;

function isDemoRow(row: TableRow): row is WireframeFlowRow {
  return "isDemo" in row && row.isDemo === true;
}

export function SmartRoutingOverviewView({
  flows,
  metrics,
  templates,
  numberMap,
  workspaceStatus,
  scheduleOverride,
  onWorkspaceRefresh,
  loading,
  onPause,
  onDuplicate,
}: {
  flows: FlowRow[];
  metrics: Metrics | null;
  templates: Template[];
  numberMap: Record<string, string>;
  workspaceStatus?: WorkspaceStatus | null;
  scheduleOverride?: { mode?: string; expiresAt?: string } | null;
  onWorkspaceRefresh?: () => void;
  loading: boolean;
  onPause: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const useWireframe = shouldUseWireframeOverview(flows.length, metrics);
  const displayMetrics = useWireframe
    ? WIREFRAME_OVERVIEW_METRICS
    : {
        activeFlows: metrics?.activeFlows ?? 0,
        routedToday: metrics?.routedToday ?? 0,
        recovered: metrics?.recovered ?? 0,
        failures: metrics?.failures ?? 0,
        trends: {
          activeFlows: metrics?.activeFlows ? 12 : null,
          routedToday: metrics?.routedToday ? 15 : null,
          recovered: metrics?.recovered ? 9 : null,
          failures: metrics?.failures ? -25 : null,
        },
      };

  const tableRows: TableRow[] = useWireframe
    ? WIREFRAME_DEMO_FLOWS
    : flows;

  const filtered = useMemo(() => {
    return tableRows.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const number = isDemoRow(f)
        ? f.businessNumberE164
        : f.businessNumberE164 ?? numberMap[f.assignedPhoneNumberId ?? ""] ?? "";
      return (
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        number.includes(q)
      );
    });
  }, [tableRows, search, statusFilter, numberMap]);

  const templateCards = templates.filter((t) => t.type !== "custom").slice(0, 4);

  return (
    <SrPageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Smart Routing</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#6b7280]">
            Keep your number. Keep your phones. Add professional call routing without changing
            carriers or installing another calling app. Return business calls from your verified
            caller ID.
          </p>
          <Link
            href="/smart-routing/setup"
            className="mt-2 inline-block text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            Open Smart Routing setup →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/numbers">
            <SrOutlineButton>
              <BookOpen className="h-4 w-4 text-[#6366f1]" />
              View Forwarding Guide
            </SrOutlineButton>
          </Link>
          <Link href="/smart-routing/new">
            <SrPrimaryButton>
              <Plus className="h-4 w-4" />
              Create Call Flow
            </SrPrimaryButton>
          </Link>
        </div>
      </div>

      {workspaceStatus ? <OverviewStatusSection status={workspaceStatus} /> : null}

      {scheduleOverride !== undefined && onWorkspaceRefresh ? (
        <CloseNowControl
          scheduleOverride={scheduleOverride}
          onUpdated={onWorkspaceRefresh}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SrMetricCard
          label="Active Flows"
          value={displayMetrics.activeFlows}
          icon={<GitBranch className="h-5 w-5" />}
          trend={displayMetrics.trends.activeFlows}
          trendLabel="vs last week"
        />
        <SrMetricCard
          label="Calls Routed Today"
          value={displayMetrics.routedToday}
          icon={<PhoneForwarded className="h-5 w-5" />}
          iconClass="bg-emerald-50 text-emerald-600"
          trend={displayMetrics.trends.routedToday}
          trendLabel="vs yesterday"
        />
        <SrMetricCard
          label="Missed Calls Recovered"
          value={displayMetrics.recovered}
          icon={<RefreshCw className="h-5 w-5" />}
          iconClass="bg-orange-50 text-orange-600"
          trend={displayMetrics.trends.recovered}
          trendLabel="vs yesterday"
        />
        <SrMetricCard
          label="Routing Failures"
          value={displayMetrics.failures}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconClass="bg-red-50 text-red-600"
          trend={displayMetrics.trends.failures}
          trendLabel="vs yesterday"
          trendPositiveIsGood={false}
        />
      </div>

      <div className={cn(srCard, "overflow-hidden")}>
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#111827]">Your Call Flows</h2>
                <span className="text-[#9ca3af]">ⓘ</span>
              </div>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Manage greetings, routing rules, and recovery paths for each business line.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-[#e5e7eb] p-0.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-semibold capitalize",
                      statusFilter === f
                        ? "bg-[#6366f1] text-white"
                        : "text-[#6b7280] hover:text-[#111827]",
                    )}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search flows…"
                  className="w-full rounded-lg border border-[#e5e7eb] py-2 pl-9 pr-3 text-[13px] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-[13px] text-[#6b7280]">Loading flows…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="bg-[#f9fafb] text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                <tr>
                  <th className="px-5 py-3">Flow Name</th>
                  <th className="px-3 py-3">Number</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Today&apos;s Calls</th>
                  <th className="px-3 py-3">Primary Destination</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((f) => {
                  const Icon = FLOW_ICONS[f.type] ?? Grid3x3;
                  const demo = isDemoRow(f);
                  const number = demo
                    ? f.businessNumberE164
                    : f.businessNumberE164 ??
                      numberMap[(f as FlowRow).assignedPhoneNumberId ?? ""] ??
                      "—";
                  const destination = demo
                    ? f.primaryDestination
                    : derivePrimaryDestination(
                        (f as FlowRow).draftConfigJson,
                        f.type,
                      );
                  const updated = demo
                    ? f.updatedLabel
                    : fmtRelativeTime((f as FlowRow).updatedAt);
                  const href = demo ? "/smart-routing/new" : `/smart-routing/${f.id}`;

                  return (
                    <tr key={f.id} className="hover:bg-[#f9fafb]/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef2ff] text-[#6366f1]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <Link
                            href={href}
                            className="font-semibold text-[#111827] hover:text-[#6366f1]"
                          >
                            {f.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[#374151]">
                        {fmtPhoneDisplay(number)}
                      </td>
                      <td className="px-3 py-4 text-[#374151]">
                        {FLOW_TYPE_LABELS[f.type] ?? f.type}
                      </td>
                      <td className="px-3 py-4">
                        <SrStatusBadge status={f.status} />
                      </td>
                      <td className="px-3 py-4 font-semibold text-[#111827]">
                        {demo ? f.todayCalls : (f as FlowRow).todayCalls ?? 0}
                      </td>
                      <td className="px-3 py-4 text-[#374151]">{destination}</td>
                      <td className="px-3 py-4 text-[#6b7280]">{updated}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={href}
                            className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#6366f1]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {!demo ? (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setMenuOpen(menuOpen === f.id ? null : f.id)
                                }
                                className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuOpen === f.id ? (
                                <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                                  <Link
                                    href={`/smart-routing/${f.id}/test`}
                                    className="block px-3 py-2 text-[13px] hover:bg-[#f9fafb]"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    Test
                                  </Link>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]"
                                    onClick={async () => {
                                      await onPause(f.id);
                                      setMenuOpen(null);
                                    }}
                                  >
                                    Pause
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]"
                                    onClick={async () => {
                                      await onDuplicate(f.id);
                                      setMenuOpen(null);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  <Link
                                    href={`/smart-routing/${f.id}/activity`}
                                    className="block px-3 py-2 text-[13px] hover:bg-[#f9fafb]"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    View Activity
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="rounded-lg p-2 text-[#9ca3af]">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#e5e7eb] px-5 py-3 text-[12px] text-[#6b7280]">
          Showing 1 to {filtered.length} of {filtered.length} results
          {useWireframe ? (
            <span className="ml-2 text-[#9ca3af]">· Sample data shown</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">Smart Routing Templates</h2>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            Start with a proven template and customize it for your business.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templateCards.map((t) => {
              const Icon = FLOW_ICONS[t.type] ?? Grid3x3;
              return (
                <Link
                  key={t.type}
                  href="/smart-routing/new"
                  className="rounded-xl border border-[#e5e7eb] p-4 transition-colors hover:border-[#c7d2fe] hover:bg-[#fafafa]"
                >
                  <Icon className="h-5 w-5 text-[#6366f1]" />
                  <p className="mt-2 text-[13px] font-bold text-[#111827]">{t.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">{t.subtitle}</p>
                  <span className="mt-3 text-[12px] font-semibold text-[#6366f1]">
                    Use Template →
                  </span>
                </Link>
              );
            })}
          </div>
          <Link
            href="/smart-routing/new"
            className="mt-4 text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            View all templates →
          </Link>
        </div>

        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">How It Works</h2>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {[
              {
                n: 1,
                icon: Phone,
                title: "Customer calls your business number",
                desc: "Callers use the number they already know.",
              },
              {
                n: 2,
                icon: Network,
                title: "Transovo routes the call automatically",
                desc: "Greeting, menu, and routing on every call.",
              },
              {
                n: 3,
                icon: Users,
                title: "Caller reaches the right person",
                desc: "Voicemail, AI, or text recovery when needed.",
              },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex flex-1 items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1] text-[12px] font-bold text-white">
                    {step.n}
                  </span>
                  {i < arr.length - 1 ? (
                    <div className="mt-2 hidden h-8 w-px border-l border-dashed border-[#c7d2fe] lg:block" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <step.icon className="h-4 w-4 text-[#6366f1]" />
                  <p className="mt-1 text-[12px] font-bold text-[#111827]">{step.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#6b7280]">{step.desc}</p>
                </div>
                {i < arr.length - 1 ? (
                  <div className="hidden flex-1 border-t border-dashed border-[#d1d5db] lg:mt-4 lg:block" />
                ) : null}
              </div>
            ))}
          </div>
          <Link
            href="/smart-routing/new"
            className="mt-6 text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            Learn more about Smart Routing →
          </Link>
        </div>
      </div>
    </SrPageShell>
  );
}
