"use client";

import { RECORDINGS_DATA, RECORDINGS_KPI } from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import {
  Bot,
  Calendar,
  Clock,
  Download,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  SlidersHorizontal,
  TrendingUp,
  User,
} from "lucide-react";
import { useState } from "react";
import { RecordingDetailPanel } from "./call-detail-panels";
import { CallTypeCell, CallsTableShell } from "./calls-table-shell";

export function RecordingsView() {
  const [selectedId, setSelectedId] = useState(RECORDINGS_DATA[0]?.id);
  const [showPanel, setShowPanel] = useState(true);
  const selected = RECORDINGS_DATA.find((r) => r.id === selectedId) ?? RECORDINGS_DATA[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Recordings</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">Listen to, download, and manage all call recordings.</p>
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
        {["All Channels", "All Agents", "All Outcomes", "All Dispositions"].map((label) => (
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total Recordings", value: RECORDINGS_KPI.total, sub: "↑ 18%", icon: Phone, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Inbound Calls", value: RECORDINGS_KPI.inbound, sub: "55% of total", icon: PhoneIncoming, tone: "bg-blue-50 text-blue-600" },
          { label: "Outbound Calls", value: RECORDINGS_KPI.outbound, sub: "45% of total", icon: PhoneOutgoing, tone: "bg-purple-50 text-purple-600" },
          { label: "Human Calls", value: RECORDINGS_KPI.human, sub: "38% of total", icon: User, tone: "bg-orange-50 text-orange-600" },
          { label: "AI Calls", value: RECORDINGS_KPI.ai, sub: "62% of total", icon: Bot, tone: "bg-violet-50 text-violet-600" },
          { label: "Total Duration", value: RECORDINGS_KPI.totalDuration, sub: "↑ 16%", icon: Clock, tone: "bg-sky-50 text-sky-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{card.label}</p>
                <p className="mt-2 text-[22px] font-bold text-[#111827]">{card.value}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
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
        rows={RECORDINGS_DATA}
        selected={selected}
        onSelect={(row) => {
          setSelectedId(row.id);
          setShowPanel(true);
        }}
        columns={["callType", "date", "caller", "agent", "duration", "outcome", "channel", "actions"]}
        footer={`Showing 1 to ${RECORDINGS_DATA.length} of ${RECORDINGS_KPI.total} recordings`}
        showPlayColumn
        renderCallType={(row) => <CallTypeCell row={row} />}
        panel={showPanel && selected ? <RecordingDetailPanel call={selected} onClose={() => setShowPanel(false)} /> : null}
      />
    </div>
  );
}
