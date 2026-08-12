"use client";

import { TRANSCRIPTS_DATA, TRANSCRIPTS_KPI } from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import { Bot, Calendar, Download, Phone, SlidersHorizontal, TrendingUp, User, Voicemail } from "lucide-react";
import { useState } from "react";
import { TranscriptDetailPanel } from "./call-detail-panels";
import { CallTypeCell, CallsTableShell } from "./calls-table-shell";

export function TranscriptsView() {
  const [selectedId, setSelectedId] = useState(TRANSCRIPTS_DATA[0]?.id);
  const [showPanel, setShowPanel] = useState(true);
  const selected = TRANSCRIPTS_DATA.find((r) => r.id === selectedId) ?? TRANSCRIPTS_DATA[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Transcripts</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">Search, view, and manage call transcripts.</p>
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
        {["All Channels", "All Agents", "All Outcomes"].map((label) => (
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
          { label: "Total Transcripts", value: TRANSCRIPTS_KPI.total, sub: "↑ 18%", icon: Phone, tone: "bg-blue-50 text-blue-600" },
          { label: "AI Calls", value: TRANSCRIPTS_KPI.ai, sub: "70% of total", icon: Bot, tone: "bg-purple-50 text-purple-600" },
          { label: "Human Calls", value: TRANSCRIPTS_KPI.human, sub: "23% of total", icon: User, tone: "bg-sky-50 text-sky-600" },
          { label: "Voicemails", value: TRANSCRIPTS_KPI.voicemails, sub: "7% of total", icon: Voicemail, tone: "bg-orange-50 text-orange-600" },
          { label: "Avg. Transcript Length", value: TRANSCRIPTS_KPI.avgLength, sub: "↑ 12%", icon: Phone, tone: "bg-emerald-50 text-emerald-600" },
        ].map((card) => (
          <div key={card.label} className="realtor-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] text-[#6b7280]">{card.label}</p>
                <p className="mt-2 text-[24px] font-bold text-[#111827]">{card.value}</p>
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
        rows={TRANSCRIPTS_DATA}
        selected={selected}
        onSelect={(row) => {
          setSelectedId(row.id);
          setShowPanel(true);
        }}
        columns={["date", "callType", "caller", "agent", "duration", "outcome", "channel", "actions"]}
        footer={`Showing 1 to ${TRANSCRIPTS_DATA.length} of ${TRANSCRIPTS_KPI.total} transcripts`}
        renderCallType={(row) => <CallTypeCell row={row} />}
        panel={showPanel && selected ? <TranscriptDetailPanel call={selected} onClose={() => setShowPanel(false)} /> : null}
      />
    </div>
  );
}
