"use client";

import {
  APPOINTMENT_TYPES_KPI,
  APPOINTMENT_TYPES_ROWS,
} from "@/lib/realtor/appointments-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CrmKpiCard, CrmPageTabs } from "../shared/crm-page-tabs";

const TYPE_TABS = [
  { label: "All Types", count: 10 },
  { label: "Consultation", count: 4 },
  { label: "Showing", count: 2 },
  { label: "Follow Up", count: 2 },
  { label: "Review", count: 1 },
  { label: "Other", count: 1 },
];

export function AppointmentTypesView() {
  const [tab, setTab] = useState("All Types");

  const filtered = useMemo(() => {
    if (tab === "All Types") return APPOINTMENT_TYPES_ROWS;
    const key = tab.toLowerCase().replace(" ", "-");
    return APPOINTMENT_TYPES_ROWS.filter((r) => r.category === key || r.name.toLowerCase().includes(tab.toLowerCase()));
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Appointment Types</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Configure appointment types, durations, and booking pages for your agents.
          </p>
        </div>
        <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
          <Plus className="h-4 w-4" />
          New Appointment Type
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="Active Types" value={APPOINTMENT_TYPES_KPI.activeTypes} hint="↑ 1 vs last month" icon={Calendar} tone="bg-purple-50 text-purple-600" />
        <CrmKpiCard label="Avg. Duration" value={APPOINTMENT_TYPES_KPI.avgDuration} hint="↑ 0.3 hrs vs last month" icon={Clock} tone="bg-blue-50 text-blue-600" />
        <CrmKpiCard label="Booking Rate" value={APPOINTMENT_TYPES_KPI.bookingRate} hint="↑ 6% vs last month" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <CrmKpiCard label="Client Rating" value={`${APPOINTMENT_TYPES_KPI.clientRating} / 5`} hint="Based on 128 reviews" icon={Star} tone="bg-amber-50 text-amber-600" />
      </div>

      <CrmPageTabs tabs={TYPE_TABS} active={tab} onChange={setTab} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input placeholder="Search types..." className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px]" />
        </div>
        <button type="button" className="realtor-btn-outline">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-2">Appointment Type</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Buffer Time</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Assigned Agents</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Booking Page</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-[12px] text-[#6b7280]">{row.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{row.duration}</td>
                <td className="px-4 py-3 text-[#6b7280]">{row.buffer}</td>
                <td className="px-4 py-3 font-medium">{row.price}</td>
                <td className="px-4 py-3">
                  <div className="flex -space-x-1">
                    {row.agents.map((a) => (
                      <span key={a} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-[10px] font-bold text-blue-700">
                        {a}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-2 text-[12px] font-semibold", row.active ? "text-emerald-600" : "text-[#9ca3af]")}>
                    <span className={cn("h-5 w-9 rounded-full", row.active ? "bg-emerald-500" : "bg-[#d1d5db]")}>
                      <span className={cn("mt-0.5 block h-4 w-4 rounded-full bg-white transition", row.active ? "ml-4" : "ml-0.5")} />
                    </span>
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-[#6b7280]">
                    <span>{row.slug}</span>
                    <Copy className="h-3.5 w-3.5 cursor-pointer hover:text-[#111827]" />
                  </div>
                </td>
                <td className="px-4 py-3"><MoreHorizontal className="h-4 w-4 text-[#9ca3af]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[13px] text-[#6b7280]">
          <span>Showing 1 to {filtered.length} of {filtered.length} results</span>
          <select className="rounded-lg border border-[#e5e7eb] px-2 py-1 text-[13px]">
            <option>10 / page</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "About Appointment Types", body: "Create custom types with duration, buffer time, agent assignment, and booking page URLs. Track analytics per type." },
          { title: "Pro Tip", body: "Use appointment types to qualify leads before they book. Set different types for buyers vs sellers.", link: "Learn more" },
          { title: "Get Started", body: "Create your first appointment type to start accepting bookings.", cta: true },
        ].map((card) => (
          <div key={card.title} className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">{card.title}</h3>
            <p className="mt-2 text-[13px] text-[#6b7280]">{card.body}</p>
            {card.link ? <button type="button" className="mt-2 text-[13px] font-semibold text-[#7c3aed]">{card.link}</button> : null}
            {card.cta ? (
              <button type="button" className="realtor-btn-primary mt-3 bg-[#7c3aed] hover:bg-[#6d28d9]">
                <Plus className="h-4 w-4" />
                Create Appointment Type
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
