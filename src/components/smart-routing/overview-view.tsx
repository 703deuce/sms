"use client";

import {
  SrMetricCard,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import {
  derivePrimaryDestination,
  FLOW_TYPE_LABELS,
  fmtPhoneDisplay,
  fmtRelativeTime,
} from "@/lib/smart-routing/display";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
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

export function SmartRoutingOverviewView({
  flows,
  metrics,
  templates,
  numberMap,
  loading,
  onPause,
  onDuplicate,
}: {
  flows: FlowRow[];
  metrics: Metrics | null;
  templates: Template[];
  numberMap: Record<string, string>;
  loading: boolean;
  onPause: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return flows.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        (numberMap[f.assignedPhoneNumberId ?? ""] ?? "").includes(q)
      );
    });
  }, [flows, search, statusFilter, numberMap]);

  const templateCards = templates.filter((t) => t.type !== "custom").slice(0, 4);

  return (
    <SrPageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#111827]">Smart Routing</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#6b7280]">
            Add a professional call menu and routing to the business number you already use.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/numbers">
            <SrOutlineButton>View Forwarding Guide</SrOutlineButton>
          </Link>
          <Link href="/smart-routing/new">
            <SrPrimaryButton>
              <Plus className="h-4 w-4" />
              Create Call Flow
            </SrPrimaryButton>
          </Link>
        </div>
      </div>

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SrMetricCard
            label="Active Flows"
            value={metrics.activeFlows}
            icon={<GitBranch className="h-4 w-4" />}
            trend={metrics.activeFlows > 0 ? 12 : null}
            trendLabel="vs last week"
          />
          <SrMetricCard
            label="Calls Routed Today"
            value={metrics.routedToday}
            icon={<PhoneForwarded className="h-4 w-4" />}
            iconClass="bg-emerald-50 text-emerald-600"
            trend={metrics.routedToday > 0 ? 15 : null}
            trendLabel="vs yesterday"
          />
          <SrMetricCard
            label="Missed Calls Recovered"
            value={metrics.recovered}
            icon={<RefreshCw className="h-4 w-4" />}
            iconClass="bg-amber-50 text-amber-600"
            trend={metrics.recovered > 0 ? 9 : null}
            trendLabel="vs yesterday"
          />
          <SrMetricCard
            label="Routing Failures"
            value={metrics.failures}
            icon={<AlertTriangle className="h-4 w-4" />}
            iconClass="bg-red-50 text-red-600"
            trend={metrics.failures > 0 ? -25 : null}
            trendLabel="vs yesterday"
          />
        </div>
      ) : null}

      <div className={cn(srCard, "overflow-hidden")}>
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <h2 className="text-[15px] font-bold text-[#111827]">Your Call Flows</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search flows…"
                className="w-full rounded-lg border border-[#e5e7eb] py-2 pl-9 pr-3 text-[13px] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize",
                    statusFilter === f
                      ? "bg-[#6366f1] text-white"
                      : "text-[#6b7280] hover:bg-[#f3f4f6]",
                  )}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-[13px] text-[#6b7280]">Loading flows…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-semibold text-[#111827]">Make your business line smarter</h3>
            <p className="mt-2 text-[13px] text-[#6b7280]">
              Add a greeting, route callers to the right person, or recover missed calls automatically.
            </p>
            <Link href="/smart-routing/new" className="mt-6 inline-block">
              <SrPrimaryButton>Create Your First Call Flow</SrPrimaryButton>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
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
                  const number =
                    f.businessNumberE164 ??
                    numberMap[f.assignedPhoneNumberId ?? ""] ??
                    "—";
                  const draft = f.draftConfigJson;
                  return (
                    <tr key={f.id} className="hover:bg-[#f9fafb]/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#6366f1]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <Link
                            href={`/smart-routing/${f.id}`}
                            className="font-semibold text-[#111827] hover:text-[#6366f1]"
                          >
                            {f.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[#374151]">{fmtPhoneDisplay(number)}</td>
                      <td className="px-3 py-4 text-[#374151]">
                        {FLOW_TYPE_LABELS[f.type] ?? f.type}
                      </td>
                      <td className="px-3 py-4">
                        <SrStatusBadge status={f.status} />
                      </td>
                      <td className="px-3 py-4 font-semibold text-[#111827]">
                        {f.todayCalls ?? 0}
                      </td>
                      <td className="px-3 py-4 text-[#374151]">
                        {derivePrimaryDestination(draft, f.type)}
                      </td>
                      <td className="px-3 py-4 text-[#6b7280]">
                        {fmtRelativeTime(f.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/smart-routing/${f.id}`}
                            className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#6366f1]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">Smart Routing Templates</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templateCards.map((t) => {
              const Icon = FLOW_ICONS[t.type] ?? Grid3x3;
              return (
                <Link
                  key={t.type}
                  href="/smart-routing/new"
                  className="rounded-xl border border-[#e5e7eb] p-4 transition-colors hover:border-[#6366f1]/40 hover:bg-[#f9fafb]"
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
          <div className="mt-6 space-y-6">
            {[
              {
                n: 1,
                icon: Phone,
                title: "Customer calls your business number",
                desc: "Callers use the number they already know — no new number required.",
              },
              {
                n: 2,
                icon: Network,
                title: "Transovo routes the call automatically",
                desc: "Your greeting, menu, and routing rules run on every inbound call.",
              },
              {
                n: 3,
                icon: Users,
                title: "Caller reaches the right person",
                desc: "Ring groups, whisper transfers, voicemail, or AI receptionist handoff.",
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6366f1] text-[11px] font-bold text-white">
                    {step.n}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <step.icon className="h-4 w-4 text-[#6366f1]" />
                    <p className="text-[13px] font-bold text-[#111827]">{step.title}</p>
                  </div>
                  <p className="mt-1 text-[12px] text-[#6b7280]">{step.desc}</p>
                </div>
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
