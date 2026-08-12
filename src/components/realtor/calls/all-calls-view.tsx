"use client";

import {
  ALL_CALLS_DATA,
  CALLS_KPI,
  type CallsTab,
  countByCallsTab,
  matchesCallsTab,
  type RealtorCallRow,
} from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  Download,
  MoreHorizontal,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Settings,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CallDetailPanel } from "./call-detail-panels";

const TAB_DEFS: Array<{ id: CallsTab; label: string }> = [
  { id: "all", label: "All Calls" },
  { id: "inbound", label: "Inbound" },
  { id: "outbound", label: "Outbound" },
  { id: "ai", label: "AI Calls" },
  { id: "human", label: "Human Calls" },
];

function DirectionBadge({ direction }: { direction: RealtorCallRow["direction"] }) {
  const inbound = direction === "inbound";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        inbound ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
      )}
    >
      {inbound ? "Inbound" : "Outbound"}
    </span>
  );
}

export function AllCallsView({ initialTab = "all" }: { initialTab?: CallsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CallsTab>(initialTab);
  const [selectedId, setSelectedId] = useState(ALL_CALLS_DATA[0]?.id);
  const [showPanel, setShowPanel] = useState(true);

  const tabCounts = useMemo(() => countByCallsTab(ALL_CALLS_DATA), []);

  const filtered = useMemo(
    () => ALL_CALLS_DATA.filter((row) => matchesCallsTab(row, tab)),
    [tab],
  );

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? ALL_CALLS_DATA[0];

  const selectTab = useCallback(
    (next: CallsTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">All Calls</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">View and manage all inbound and outbound calls.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="realtor-btn-primary">
            <Settings className="h-4 w-4" />
            Phone Settings
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
        {TAB_DEFS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                "mb-[-1px] border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
                active
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {t.label}
              {t.id !== "all" ? (
                <span className="ml-1.5 text-[11px] font-normal text-[#9ca3af]">({tabCounts[t.id]})</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="realtor-card flex flex-wrap gap-3 p-4">
        <button type="button" className="realtor-btn-outline h-9">
          <Calendar className="h-4 w-4" />
          May 13 – May 20, 2025
        </button>
        {["All Numbers", "All Agents", "All Outcomes", "All Dispositions"].map((label) => (
          <select key={label} className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>{label}</option>
          </select>
        ))}
        <button type="button" className="realtor-btn-outline h-9">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">
            2
          </span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total Calls", value: CALLS_KPI.total, sub: "↑ 18% vs prev week", up: true, icon: Phone, tone: "bg-blue-50 text-blue-600" },
          { label: "Inbound Calls", value: CALLS_KPI.inbound, sub: "64% of total", icon: PhoneIncoming, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Outbound Calls", value: CALLS_KPI.outbound, sub: "36% of total", icon: PhoneOutgoing, tone: "bg-sky-50 text-sky-600" },
          { label: "AI Answered", value: CALLS_KPI.aiAnswered, sub: "56% of inbound", icon: Phone, tone: "bg-purple-50 text-purple-600" },
          { label: "Voicemails", value: CALLS_KPI.voicemails, sub: "17% of inbound", icon: Voicemail, tone: "bg-orange-50 text-orange-600" },
          { label: "Avg. Call Duration", value: CALLS_KPI.avgDuration, sub: "↓ 12% vs prev week", up: false, icon: Phone, tone: "bg-amber-50 text-amber-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{card.label}</p>
                <p className="mt-2 text-[24px] font-bold text-[#111827]">{card.value}</p>
                <p className={cn("mt-1 flex items-center gap-1 text-[11px]", card.up === false ? "text-red-600" : card.up ? "text-emerald-600" : "text-[#6b7280]")}>
                  {card.up === true ? <TrendingUp className="h-3 w-3" /> : card.up === false ? <TrendingDown className="h-3 w-3" /> : null}
                  {card.sub}
                </p>
              </div>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-[10px]", card.tone)}>
                <card.icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="min-w-0 flex-1">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                <tr>
                  <th className="w-8 px-4 py-3"><input type="checkbox" aria-label="Select all" /></th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Caller / Recipient</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Disposition</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                      setShowPanel(true);
                    }}
                    className={cn(
                      "cursor-pointer hover:bg-[#f9fafb]",
                      selected?.id === row.id && "bg-[#eff6ff]",
                    )}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${row.callerName}`} />
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{row.dateTime}</td>
                    <td className="px-4 py-3"><DirectionBadge direction={row.direction} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[10px] font-bold text-[#2563eb]">
                          {row.callerInitials}
                        </span>
                        <span>
                          <span className="font-semibold text-[#111827]">{row.callerName}</span>
                          <br />
                          <span className="text-[12px] text-[#6b7280]">{row.callerPhone}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111827]">{row.number}</div>
                      <div className="text-[12px] text-[#6b7280]">{row.numberLabel}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111827]">{row.agent}</div>
                      {row.agentStatus ? (
                        <div className={cn("text-[11px]", row.agentType === "ai" ? "text-emerald-600" : "text-[#6b7280]")}>
                          {row.agentStatus}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.outcomeClass)}>
                        {row.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.duration}</td>
                    <td className="px-4 py-3 text-[#374151]">{row.disposition}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-[#2563eb]">
                        {row.hasRecording ? <Play className="h-4 w-4" /> : null}
                        <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
            <span>Showing 1 to {filtered.length} of {CALLS_KPI.total} calls</span>
            <div className="flex items-center gap-2">
              <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[12px]">
                <option>20 per page</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">‹</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white">1</span>
                <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">2</Link>
                <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">3</Link>
                <span className="px-1">…</span>
                <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">13</Link>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">›</span>
              </div>
            </div>
          </div>
        </div>

        {showPanel && selected ? <CallDetailPanel call={selected} onClose={() => setShowPanel(false)} /> : null}
      </div>
    </div>
  );
}
