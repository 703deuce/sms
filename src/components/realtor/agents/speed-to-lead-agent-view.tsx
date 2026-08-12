"use client";

import {
  SPEED_FAILURES,
  SPEED_OPERATIONS,
  SPEED_RECENT_OPS,
  SPEED_SOURCES,
  SPEED_TO_LEAD_KPI,
} from "@/lib/realtor/agents-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronRight,
  Eye,
  Phone,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentKpiCard, AgentPageTabs } from "./agent-page-tabs";

const TABS = ["Overview", "Responsiveness", "Personal", "Scenarios", "Performance", "Compliance", "Settings"];

const ENGAGEMENT_POINTS = [420, 380, 510, 460, 620, 580, 720];

export function SpeedToLeadAgentView() {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Speed-to-Lead</h1>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Outbound AI agent that contacts new leads within minutes and qualifies them for your team.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">
            <Settings className="mr-1.5 h-4 w-4" />
            Agent Settings
          </button>
          <Link href="/realtor/test" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            Test Agent
          </Link>
        </div>
      </div>

      <AgentPageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AgentKpiCard label="Engagements" value={SPEED_TO_LEAD_KPI.engagements} hint="↑ 1.5%" icon={Zap} tone="bg-purple-50 text-purple-600" />
            <AgentKpiCard label="Leads Processed" value={SPEED_TO_LEAD_KPI.leadsProcessed.toLocaleString()} hint="↑ 15%" icon={Users} tone="bg-emerald-50 text-emerald-600" />
            <AgentKpiCard label="Calls Made" value={SPEED_TO_LEAD_KPI.callsMade} hint="↑ 5%" icon={Phone} tone="bg-blue-50 text-blue-600" />
            <AgentKpiCard label="Appointments" value={SPEED_TO_LEAD_KPI.appointments} hint="↓ 2.5%" icon={Calendar} tone="bg-amber-50 text-amber-600" />
            <AgentKpiCard label="Conversion Rate" value={SPEED_TO_LEAD_KPI.conversionRate} hint="↑ 1.2%" icon={TrendingUp} tone="bg-yellow-50 text-yellow-600" />
            <AgentKpiCard label="Impressions" value={SPEED_TO_LEAD_KPI.impressions} hint="↑ 12%" icon={Eye} tone="bg-purple-50 text-purple-600" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr_0.8fr_260px]">
            <div className="realtor-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#111827]">Engagements Over Time</h3>
                <span className="text-[12px] text-[#6b7280]">Last 7 days</span>
              </div>
              <div className="mt-4 flex h-40 items-end gap-2">
                {ENGAGEMENT_POINTS.map((val, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[#7c3aed] to-[#a78bfa]"
                      style={{ height: `${(val / 720) * 100}%` }}
                    />
                    <span className="text-[10px] text-[#9ca3af]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Operations Status</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0">
                  <div className="absolute inset-0 rounded-full border-[10px] border-emerald-500 border-r-blue-500 border-b-orange-400 border-l-amber-400" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[18px] font-bold">1236</span>
                    <span className="text-[10px] text-[#6b7280]">Total</span>
                  </div>
                </div>
                <ul className="space-y-2 text-[12px]">
                  {SPEED_OPERATIONS.map((op) => (
                    <li key={op.label} className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", op.color)} />
                      {op.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Reason for Failure</h3>
              <ul className="mt-4 space-y-3">
                {SPEED_FAILURES.map((item) => (
                  <li key={item.label}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                      <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#7c3aed]" />
                <h3 className="font-semibold text-[#111827]">Latest Event</h3>
              </div>
              <p className="mt-1 text-[11px] text-[#6b7280]">Speed-to-Lead Agent · 10:42 AM</p>
              <ul className="mt-4 space-y-3 border-l-2 border-[#e5e7eb] pl-3 text-[12px]">
                {["Agent started lead analysis", "Initial contact attempt", "Lead qualified", "Appointment offered"].map((step, i) => (
                  <li key={step} className={cn("relative", i < 2 ? "text-[#111827]" : "text-[#9ca3af]")}>
                    <span className={cn("absolute -left-[17px] top-1 h-2 w-2 rounded-full", i < 2 ? "bg-[#7c3aed]" : "bg-[#d1d5db]")} />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr_260px]">
            <div className="realtor-card overflow-hidden">
              <div className="border-b border-[#e5e7eb] px-4 py-3">
                <h3 className="font-semibold text-[#111827]">Recent Lead Operations</h3>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-2">Lead</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {SPEED_RECENT_OPS.map((row) => (
                    <tr key={row.lead} className="hover:bg-[#f9fafb]">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.lead}</div>
                        <div className="text-[12px] text-[#6b7280]">{row.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[#6b7280]">{row.time}</td>
                      <td className="px-4 py-3">{row.duration}</td>
                      <td className="px-4 py-3 text-[#7c3aed]">{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[#e5e7eb] py-3 text-center">
                <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All Operations</Link>
              </div>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Top Lead Sources</h3>
              <ul className="mt-4 space-y-3">
                {SPEED_SOURCES.map((src) => (
                  <li key={src.name}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span>{src.name}</span>
                      <span className="text-[#6b7280]">{src.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                      <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${src.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="#" className="mt-4 block text-[13px] font-semibold text-[#7c3aed]">View All Sources</Link>
            </div>

            <div className="space-y-4">
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Quick Actions</h3>
                <ul className="mt-3 space-y-2">
                  {["Run Agent Analysis", "Download Lead List", "Add Manual Lead"].map((action) => (
                    <li key={action}>
                      <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] hover:bg-[#f9fafb]">
                        {action}
                        <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Last Check</h3>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between"><dt className="text-[#6b7280]">Status</dt><dd className="font-medium text-emerald-600">Active</dd></div>
                  <div className="flex justify-between"><dt className="text-[#6b7280]">Total Executions</dt><dd className="font-medium">1308</dd></div>
                  <div className="flex justify-between"><dt className="text-[#6b7280]">Last Run</dt><dd className="font-medium">20 min ago</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="realtor-card p-8 text-center text-[#6b7280]">
          <Target className="mx-auto h-8 w-8 text-[#9ca3af]" />
          <p className="mt-3 text-[15px] font-medium text-[#111827]">{tab}</p>
          <p className="mt-1 text-[13px]">Configure this section in agent settings.</p>
        </div>
      )}
    </div>
  );
}
