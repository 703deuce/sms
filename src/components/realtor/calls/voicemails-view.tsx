"use client";

import { VOICEMAILS_DATA, VOICEMAILS_KPI } from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Download,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Voicemail,
} from "lucide-react";
import { useState } from "react";
import { VoicemailDetailPanel } from "./call-detail-panels";
import { CallsTableShell } from "./calls-table-shell";

export function VoicemailsView() {
  const [selectedId, setSelectedId] = useState(VOICEMAILS_DATA[0]?.id);
  const [showPanel, setShowPanel] = useState(true);
  const selected = VOICEMAILS_DATA.find((r) => r.id === selectedId) ?? VOICEMAILS_DATA[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Voicemails</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">View and manage all voicemails left by callers.</p>
        </div>
        <button type="button" className="realtor-btn-outline">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="realtor-card flex flex-wrap gap-3 p-4">
        <button type="button" className="realtor-btn-outline h-9">
          <Calendar className="h-4 w-4" />
          May 13 – May 20, 2025
        </button>
        {["All Numbers", "All Agents", "All Dispositions"].map((label) => (
          <select key={label} className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>{label}</option>
          </select>
        ))}
        <button type="button" className="realtor-btn-outline h-9">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">2</span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Voicemails", value: VOICEMAILS_KPI.total, sub: "↑ 27% vs last week", up: true, icon: Voicemail, tone: "bg-orange-50 text-orange-600" },
          { label: "New Voicemails", value: VOICEMAILS_KPI.new, sub: "86% of total", icon: Voicemail, tone: "bg-blue-50 text-blue-600" },
          { label: "Unique Callers", value: VOICEMAILS_KPI.uniqueCallers, sub: "↑ 17% vs last week", up: true, icon: Users, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Avg. Duration", value: VOICEMAILS_KPI.avgDuration, sub: "↑ 13% vs last week", up: true, icon: Voicemail, tone: "bg-purple-50 text-purple-600" },
          { label: "Calls to Voicemail", value: VOICEMAILS_KPI.callsToVmPct, sub: "↓ 6% vs last week", up: false, icon: Voicemail, tone: "bg-red-50 text-red-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] text-[#6b7280]">{card.label}</p>
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

      <CallsTableShell
        rows={VOICEMAILS_DATA}
        selected={selected}
        onSelect={(row) => {
          setSelectedId(row.id);
          setShowPanel(true);
        }}
        columns={["date", "caller", "phone", "duration", "agent", "disposition", "actions"]}
        footer={`Showing 1 to ${VOICEMAILS_DATA.length} of ${VOICEMAILS_KPI.total} voicemails`}
        panel={showPanel && selected ? <VoicemailDetailPanel call={selected} onClose={() => setShowPanel(false)} /> : null}
      />
    </div>
  );
}
