"use client";

import { LISTS_DATA } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Layers, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ListsSegmentsView() {
  const [tab, setTab] = useState<"lists" | "segments">("lists");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Lists / Segments</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Organize leads into lists and segments to target the right people.
          </p>
        </div>
        <button type="button" className="realtor-btn-primary">
          <Plus className="h-4 w-4" />
          New List
        </button>
      </div>

      <div className="flex gap-6 border-b border-[#e5e7eb] text-[14px]">
        <button
          type="button"
          onClick={() => setTab("lists")}
          className={cn(
            "pb-2 font-semibold",
            tab === "lists" ? "border-b-2 border-[#2563eb] text-[#2563eb]" : "text-[#6b7280]",
          )}
        >
          Lists
        </button>
        <button
          type="button"
          onClick={() => setTab("segments")}
          className={cn(
            "pb-2 font-semibold",
            tab === "segments" ? "border-b-2 border-[#2563eb] text-[#2563eb]" : "text-[#6b7280]",
          )}
        >
          Segments
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Lists", value: 12, sub: "All time", icon: Layers, tone: "bg-blue-50 text-blue-600" },
          { label: "Total Leads", value: "2,487", sub: "Across all lists", icon: Users, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Avg. List Size", value: 207, sub: "Leads per list", icon: Users, tone: "bg-purple-50 text-purple-600" },
          { label: "Engagement Rate", value: "18.6%", sub: "Across all lists", icon: ArrowUpDown, tone: "bg-orange-50 text-orange-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] text-[#6b7280]">{card.label}</p>
                <p className="mt-2 text-[28px] font-bold text-[#111827]">{card.value}</p>
                <p className="text-[12px] text-[#6b7280]">{card.sub}</p>
              </div>
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", card.tone)}>
                <card.icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="realtor-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input placeholder="Search lists..." className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-10 pr-3 text-[14px]" />
          </div>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>All List Types</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>All Created By</option>
          </select>
          <button type="button" className="realtor-btn-outline">
            <ArrowUpDown className="h-4 w-4" />
            Sort: Last Updated
          </button>
        </div>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">List Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {LISTS_DATA.map((list) => (
              <tr key={list.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-bold text-white", list.color)}>
                      {list.initials}
                    </span>
                    <span>
                      <span className="font-semibold text-[#111827]">{list.name}</span>
                      <br />
                      <span className="text-[12px] text-[#6b7280]">{list.description}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", list.typeClass)}>
                    {list.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{list.leads}</td>
                <td className="px-4 py-3 text-[#6b7280]">{list.created}</td>
                <td className="px-4 py-3 text-[#6b7280]">{list.updated}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-bold">
                      {list.ownerInitials}
                    </span>
                    {list.owner}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button type="button" aria-label="More">
                    <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
          <span>Showing 1 to 8 of 12 lists</span>
          <div className="flex items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">‹</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white">1</span>
            <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">2</Link>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
