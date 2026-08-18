"use client";

import {
  APPOINTMENTS_KPI,
  APPOINTMENTS_ROWS,
  APPOINTMENTS_TAB_COUNTS,
  type AppointmentsTab,
} from "@/lib/realtor/appointments-crm-mock";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Users,
  Video,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CrmKpiCard, CrmPageTabs } from "../shared/crm-page-tabs";

const TAB_DEFS: Array<{ id: AppointmentsTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "completed", label: "Completed" },
  { id: "canceled", label: "Canceled" },
  { id: "no-show", label: "No Show" },
];

function LocationIcon({ location }: { location: string }) {
  if (location.includes("Video")) return <Video className="h-3.5 w-3.5 text-[#6b7280]" />;
  if (location.includes("Phone")) return <Phone className="h-3.5 w-3.5 text-[#6b7280]" />;
  return <MapPin className="h-3.5 w-3.5 text-[#6b7280]" />;
}

export function AppointmentsListView({ initialTab = "all" }: { initialTab?: AppointmentsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AppointmentsTab>(initialTab);

  const filtered = useMemo(
    () => (tab === "all" ? APPOINTMENTS_ROWS : APPOINTMENTS_ROWS.filter((r) => r.tab === tab)),
    [tab],
  );

  const selectTab = useCallback(
    (next: AppointmentsTab) => {
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Appointments</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">View and manage all scheduled appointments.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            <Plus className="h-4 w-4" />
            New Appointment
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CrmPageTabs
        tabs={TAB_DEFS.map((t) => ({ label: t.label, count: APPOINTMENTS_TAB_COUNTS[t.id] }))}
        active={TAB_DEFS.find((t) => t.id === tab)?.label ?? "All"}
        onChange={(label) => {
          const found = TAB_DEFS.find((t) => t.label === label);
          if (found) selectTab(found.id);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CrmKpiCard label="Total Appointments" value={APPOINTMENTS_KPI.total} hint="↑ 18% vs May 11 – May 17" icon={Calendar} tone="bg-purple-50 text-purple-600" />
        <CrmKpiCard label="Confirmed" value={`${APPOINTMENTS_KPI.confirmed} (${APPOINTMENTS_KPI.confirmedPct}%)`} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <CrmKpiCard label="Upcoming" value={APPOINTMENTS_KPI.upcoming} hint="Next 7 days" icon={Clock} tone="bg-amber-50 text-amber-600" />
        <CrmKpiCard label="Clients" value={APPOINTMENTS_KPI.clients} hint="This week" icon={Users} tone="bg-purple-50 text-purple-600" />
        <CrmKpiCard label="Avg. Duration" value={APPOINTMENTS_KPI.avgDuration} hint="↑ 0.6 hrs vs last week" icon={BarChart3} tone="bg-blue-50 text-blue-600" />
      </div>

      <div className="realtor-card flex flex-wrap items-center gap-3 p-3">
        <button type="button" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px]">May 18 – May 24, 2025</button>
        <button type="button" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px]">All Agents</button>
        <button type="button" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px]">All Types</button>
        <button type="button" className="ml-auto rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-semibold">Filters (2)</button>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-2"><input type="checkbox" className="rounded" /></th>
              <th className="px-4 py-2">Date & Time ↓</th>
              <th className="px-4 py-2">Appointment</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Location / Details</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.date}</div>
                  <div className="text-[12px] text-[#6b7280]">{row.time}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{row.title}</div>
                  <div className="text-[12px] text-[#9ca3af]">ID: {row.aptId}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.typeClass)}>{row.type}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.client}</div>
                  <div className="text-[12px] text-[#6b7280]">{row.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                      {row.agent.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <div>
                      <div className="font-medium">{row.agent}</div>
                      <div className="text-[11px] text-[#6b7280]">{row.agentRole}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <LocationIcon location={row.location} />
                    <span>{row.location}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#6b7280]">{row.source}</td>
                <td className="px-4 py-3"><MoreHorizontal className="h-4 w-4 text-[#9ca3af]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[13px]">
          <span className="text-[#6b7280]">Showing 1 to {filtered.length} of {APPOINTMENTS_KPI.total} appointments</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-semibold",
                  n === 1 ? "bg-[#7c3aed] text-white" : "hover:bg-[#f3f4f6]",
                )}
              >
                {n}
              </button>
            ))}
            <span className="px-2 text-[#6b7280]">… 16</span>
          </div>
          <select className="rounded-lg border border-[#e5e7eb] px-2 py-1 text-[13px]">
            <option>10 / page</option>
          </select>
        </div>
      </div>
    </div>
  );
}
