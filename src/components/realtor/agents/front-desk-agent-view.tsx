"use client";

import {
  FRONT_DESK_DISPOSITIONS,
  FRONT_DESK_KPI,
  FRONT_DESK_LEAD_NEEDS,
  FRONT_DESK_RECENT,
} from "@/lib/realtor/agents-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Copy,
  MessageSquare,
  Phone,
  Settings,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentKpiCard, AgentPageTabs } from "./agent-page-tabs";

const TABS = ["Overview", "Instructions", "Knowledge", "Conversations", "Appointments", "Dispositions", "Settings"];

export function FrontDeskAgentView() {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Front Desk</h1>
            <span className="text-[14px] text-[#6b7280]">ID: 4321</span>
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            An AI set to capture the information and book appointments with prospective home buyers.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/realtor/test" className="realtor-btn-outline border-[#7c3aed] text-[#7c3aed]">
            View Chat
          </Link>
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            Edit Agent
          </button>
        </div>
      </div>

      <AgentPageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <AgentKpiCard label="Total Leads" value={FRONT_DESK_KPI.totalLeads.toLocaleString()} hint="↑ 12% vs last month" icon={UserPlus} tone="bg-purple-50 text-purple-600" />
              <AgentKpiCard label="Total Conversations" value={FRONT_DESK_KPI.conversations} hint="↑ 8% vs last month" icon={MessageSquare} tone="bg-emerald-50 text-emerald-600" />
              <AgentKpiCard label="Managed Rate" value={FRONT_DESK_KPI.managedRate} hint="34% so far" icon={Users} tone="bg-blue-50 text-blue-600" />
              <AgentKpiCard label="Appointments Booked" value={FRONT_DESK_KPI.appointments} hint="↑ 8% vs last month" icon={Calendar} tone="bg-amber-50 text-amber-600" />
              <AgentKpiCard label="Conversion Rate" value={FRONT_DESK_KPI.conversionRate} hint="↑ 15% vs last month" icon={TrendingUp} tone="bg-pink-50 text-pink-600" />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Top Five Lead Needs</h3>
                <ul className="mt-4 space-y-3">
                  {FRONT_DESK_LEAD_NEEDS.map((item) => (
                    <li key={item.label} className="flex items-center gap-3 text-[13px]">
                      <span className={cn("h-2.5 w-2.5 rounded-full", item.color)} />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Top Dispositions</h3>
                <ul className="mt-4 space-y-3 text-[13px]">
                  {FRONT_DESK_DISPOSITIONS.map((item) => (
                    <li key={item.label} className="flex justify-between">
                      <span className="text-[#374151]">{item.label}</span>
                      <span className="font-semibold text-[#111827]">{item.count} leads</span>
                    </li>
                  ))}
                </ul>
                <Link href="#" className="mt-4 block text-[13px] font-semibold text-[#7c3aed]">View all Dispositions</Link>
              </div>
            </div>

            <div className="realtor-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                <h3 className="font-semibold text-[#111827]">Recent Resource</h3>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Lead</th>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {FRONT_DESK_RECENT.map((row) => (
                    <tr key={row.lead} className="hover:bg-[#f9fafb]">
                      <td className="px-4 py-3">
                        {row.type === "call" ? <Phone className="h-4 w-4 text-[#6b7280]" /> : <MessageSquare className="h-4 w-4 text-[#6b7280]" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.lead}</div>
                        <div className="text-[12px] text-[#6b7280]">{row.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-[#6b7280]">{row.time}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3">{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Performance Overview</h3>
              <div className="mt-4 flex h-10 overflow-hidden rounded-lg">
                <div className="flex items-center justify-center bg-[#7c3aed] px-3 text-[11px] font-semibold text-white" style={{ width: "45%" }}>Total 856</div>
                <div className="flex items-center justify-center bg-emerald-500 px-2 text-[11px] font-semibold text-white" style={{ width: "12%" }}>92</div>
                <div className="flex items-center justify-center bg-blue-500 px-2 text-[11px] font-semibold text-white" style={{ width: "28%" }}>255</div>
                <div className="flex items-center justify-center bg-amber-400 px-2 text-[11px] font-semibold text-white" style={{ width: "8%" }}>12%</div>
                <div className="flex items-center justify-center bg-red-400 px-2 text-[11px] font-semibold text-white" style={{ width: "7%" }}>34%</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#6b7280]">
                <span>Answered</span><span>Busy</span><span>Not Answered</span><span>Failed</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="realtor-card p-4">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                  <Sparkles className="h-7 w-7" />
                </span>
                <h3 className="mt-3 text-[16px] font-bold">Front Desk</h3>
                <p className="text-[12px] text-emerald-600">Active since June 12, 2025</p>
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                {[
                  ["Phone", "(571) 555-0198"],
                  ["Knowledge", "All Real Estate Knowledge"],
                  ["Campaign", "0-15 Minute Lead"],
                  ["Target", "0-15 Minute Lead"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-[#6b7280]">{k}</dt>
                    <dd className="text-right font-medium text-[#111827]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Test This Agent</h3>
              <div className="mt-3 flex gap-2">
                <input placeholder="Enter phone number" className="h-9 flex-1 rounded-lg border border-[#e5e7eb] px-3 text-[13px]" />
                <button type="button" className="realtor-btn-primary bg-[#7c3aed]">Run test</button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[#f9fafb] px-3 py-2 text-[13px]">
                <span>(571) 555-0198</span>
                <div className="flex gap-2 text-[#7c3aed]">
                  <MessageSquare className="h-4 w-4" />
                  <Phone className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Direct Link</h3>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] text-[#6b7280]">
                <span className="flex-1 truncate">transovo.ai/agent/front-desk</span>
                <Copy className="h-4 w-4 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="realtor-card p-8 text-center text-[#6b7280]">
          <Settings className="mx-auto h-8 w-8 text-[#9ca3af]" />
          <p className="mt-3 text-[15px] font-medium text-[#111827]">{tab}</p>
          <p className="mt-1 text-[13px]">Configure this section in agent settings.</p>
        </div>
      )}
    </div>
  );
}
