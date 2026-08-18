"use client";

import {
  AVAILABILITY_AGENTS,
  AVAILABILITY_KPI,
  WEEKLY_BLOCKS,
} from "@/lib/realtor/appointments-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Lock,
  Moon,
  Plus,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { CrmKpiCard, CrmPageTabs } from "../shared/crm-page-tabs";

const TABS = ["Weekly Schedule", "Date Overrides (3)", "Holidays (8)"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0];
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 48;

const BLOCK_STYLES = {
  available: { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-800", icon: Calendar },
  "after-hours": { bg: "bg-purple-100 border-purple-300", text: "text-purple-800", icon: Moon },
  break: { bg: "bg-amber-100 border-amber-300", text: "text-amber-800", icon: Utensils },
  unavailable: { bg: "bg-gray-100 border-gray-300", text: "text-gray-500", icon: Lock },
};

export function AvailabilityView() {
  const [tab, setTab] = useState("Weekly Schedule");
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Availability</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Set when your AI agents are available to answer calls, book appointments, and follow up.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            <Plus className="h-4 w-4" />
            Add Availability Rule
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="Total Available Hours" value={AVAILABILITY_KPI.totalHours} hint="↑ 6 hrs vs last week" icon={Clock} tone="bg-emerald-50 text-emerald-600" />
        <CrmKpiCard label="Active Schedules" value={AVAILABILITY_KPI.activeSchedules} hint="Across agents" icon={Calendar} tone="bg-purple-50 text-purple-600" />
        <CrmKpiCard label="Time Zone" value="ET" hint={AVAILABILITY_KPI.timezone} icon={Globe} tone="bg-blue-50 text-blue-600" />
        <CrmKpiCard label="After Hours" value={AVAILABILITY_KPI.afterHours} hint="Edit settings" icon={Moon} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <CrmPageTabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === "Weekly Schedule" ? (
            <>
              <div className="realtor-card flex flex-wrap items-center gap-3 p-3">
                <select className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px]">
                  <option>All Agents</option>
                </select>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-semibold">This Week</button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" className="ml-auto realtor-btn-outline text-[13px]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </button>
              </div>

              <div className="realtor-card overflow-hidden">
                <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-[#e5e7eb] bg-[#fafbfc]">
                  <div />
                  {DAY_LABELS.map((d, i) => (
                      <div key={d} className="border-l border-[#e5e7eb] px-2 py-2 text-center">
                        <p className="text-[11px] font-semibold text-[#6b7280]">{d}</p>
                        <p className="text-[12px] font-bold text-[#111827]">May {19 + i}</p>
                      </div>
                  ))}
                </div>
                <div className="grid grid-cols-[48px_repeat(7,1fr)]">
                  <div className="border-r border-[#e5e7eb] bg-[#fafbfc]">
                    {hours.map((h) => (
                      <div key={h} className="flex items-start justify-end border-b border-[#f0f1f4] pr-2 pt-1 text-[10px] text-[#9ca3af]" style={{ height: HOUR_HEIGHT }}>
                        {h <= 12 ? `${h === 12 ? 12 : h} AM` : `${h - 12} PM`}
                      </div>
                    ))}
                  </div>
                  {DAY_LABELS.map((d, colIndex) => {
                    const dayIndex = DAY_INDEX_MAP[colIndex];
                    const dayBlocks = WEEKLY_BLOCKS.filter((b) => b.dayIndex === dayIndex);
                    const isUnavailable = dayBlocks.some((b) => b.type === "unavailable");
                    return (
                      <div key={dayIndex} className="relative border-l border-[#e5e7eb]">
                        {hours.map((h) => (
                          <div key={h} className="border-b border-[#f0f1f4]" style={{ height: HOUR_HEIGHT }} />
                        ))}
                        {isUnavailable ? (
                          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-lg bg-gray-50 text-[11px] text-[#9ca3af]">
                            <Lock className="mb-1 h-4 w-4" />
                            Unavailable
                            <span>All day</span>
                          </div>
                        ) : (
                          dayBlocks
                            .filter((b) => b.type !== "unavailable" && "startMinutes" in b)
                            .map((block, i) => {
                              const b = block as { startMinutes: number; endMinutes: number; type: keyof typeof BLOCK_STYLES; label?: string };
                              const style = BLOCK_STYLES[b.type];
                              const top = ((b.startMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;
                              const height = ((b.endMinutes - b.startMinutes) / 60) * HOUR_HEIGHT;
                              const Icon = style.icon;
                              return (
                                <div
                                  key={i}
                                  className={cn("absolute left-1 right-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold", style.bg, style.text)}
                                  style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                                >
                                  <Icon className="mb-0.5 h-3 w-3" />
                                  {b.label ?? (b.type === "after-hours" ? "After Hours (AI)" : "Available")}
                                </div>
                              );
                            })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="realtor-card flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <h3 className="font-semibold text-[#111827]">After Hours Settings</h3>
                  <p className="mt-1 text-[13px] text-[#6b7280]">
                    6:00 PM – 8:00 AM Mon–Fri · Weekends all day · AI answers and takes messages
                  </p>
                </div>
                <button type="button" className="realtor-btn-outline">Edit After Hours</button>
              </div>
            </>
          ) : (
            <div className="realtor-card p-8 text-center text-[#6b7280]">
              <Calendar className="mx-auto h-8 w-8 text-[#9ca3af]" />
              <p className="mt-3 font-medium text-[#111827]">{tab}</p>
              <p className="mt-1 text-[13px]">Manage {tab.toLowerCase()} in this section.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Schedule Overview</h3>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <div className="absolute inset-0 rounded-full border-[10px] border-emerald-500 border-r-purple-400" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[16px] font-bold">42</span>
                  <span className="text-[10px] text-[#6b7280]">Hours</span>
                </div>
              </div>
              <ul className="space-y-1 text-[12px]">
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available: 35 hrs (83%)</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-400" /> After Hours: 7 hrs (17%)</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-300" /> Unavailable: 0 hrs</li>
              </ul>
            </div>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Active Agents</h3>
            <ul className="mt-3 space-y-3">
              {AVAILABILITY_AGENTS.map((agent) => (
                <li key={agent.name} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-[11px] text-emerald-600">{agent.status}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-3 text-[13px] font-semibold text-[#7c3aed]">Manage Agent Schedules →</button>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">Need Help?</h3>
            <p className="mt-2 text-[13px] text-[#6b7280]">Learn how to set up availability for your AI agents.</p>
            <button type="button" className="realtor-btn-outline mt-3 w-full">View Guide</button>
          </div>
        </div>
      </div>
    </div>
  );
}
