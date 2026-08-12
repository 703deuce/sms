"use client";

import { ACTIVITY_KPI, ACTIVITY_ROWS } from "@/lib/realtor/agents-crm-mock";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronRight,
  Download,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentKpiCard, AgentPageTabs } from "./agent-page-tabs";

const TABS = ["Overview", "Activity Logs", "All Calls", "Live Interactions", "Performance", "Smart Analytics"];

const TREND_DATA = [180, 220, 195, 280, 310, 260, 340];

export function AgentActivityView() {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Agent Activity</h1>
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Track agent performance, interactions, and outcomes across your pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">
            <Download className="mr-1.5 h-4 w-4" />
            Export Data
          </button>
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            <Plus className="mr-1.5 h-4 w-4" />
            Create Agent
          </button>
        </div>
      </div>

      <AgentPageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <AgentKpiCard label="Conversations" value={ACTIVITY_KPI.conversations.toLocaleString()} hint="↑ 2.4% last 7 days" icon={MessageSquare} tone="bg-purple-50 text-purple-600" />
              <AgentKpiCard label="Contacts" value={ACTIVITY_KPI.contacts.toLocaleString()} hint="↑ 1.2% last 7 days" icon={Users} tone="bg-emerald-50 text-emerald-600" />
              <AgentKpiCard label="Messages" value={ACTIVITY_KPI.messages} hint="↓ 1.5% last 7 days" icon={Zap} tone="bg-orange-50 text-orange-600" />
              <AgentKpiCard label="Calls" value={ACTIVITY_KPI.calls} hint="↑ 0.5% last 7 days" icon={Phone} tone="bg-red-50 text-red-600" />
              <AgentKpiCard label="Lead Gen Activity" value={ACTIVITY_KPI.leadGen} hint="↓ 3.1% last 7 days" icon={Activity} tone="bg-blue-50 text-blue-600" />
              <AgentKpiCard label="Avg. Response Time" value={ACTIVITY_KPI.avgResponse} hint="↑ 0.2% last 7 days" icon={BarChart3} tone="bg-purple-50 text-purple-600" />
            </div>

            <div className="realtor-card flex flex-wrap items-center gap-3 p-3">
              <button type="button" className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px]">
                <Calendar className="h-4 w-4 text-[#6b7280]" />
                Oct 21 – Oct 27, 2025
              </button>
              {["Search", "All Agents", "Channels", "Flow"].map((filter) => (
                <button key={filter} type="button" className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px] text-[#374151]">
                  {filter}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-[#7c3aed]">
                  <Plus className="h-4 w-4" /> Add Filter
                </button>
                <button type="button" className="text-[13px] text-[#6b7280]">Clear All</button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Interaction Over Time</h3>
                <div className="mt-4 flex h-36 items-end gap-1">
                  {TREND_DATA.map((val, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-gradient-to-t from-[#7c3aed]/20 to-[#7c3aed]" style={{ height: `${(val / 340) * 100}%` }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Interaction by Channel</h3>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <div className="absolute inset-0 rounded-full border-[10px] border-purple-500 border-r-blue-500 border-b-emerald-500 border-l-orange-400" />
                  </div>
                  <ul className="space-y-1 text-[12px]">
                    <li>SMS 45%</li>
                    <li>Email 25%</li>
                    <li>Voice 15%</li>
                    <li>Chat 15%</li>
                  </ul>
                </div>
              </div>

              <div className="realtor-card p-4">
                <h3 className="font-semibold text-[#111827]">Interaction by Outcome</h3>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0">
                    <div className="absolute inset-0 rounded-full border-[10px] border-emerald-500 border-r-red-400 border-b-amber-400 border-l-blue-500" />
                  </div>
                  <ul className="space-y-1 text-[12px]">
                    <li className="text-emerald-600">Scheduled 42%</li>
                    <li className="text-red-500">Not Interested 28%</li>
                    <li>Follow up 18%</li>
                    <li>Other 12%</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="realtor-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                <h3 className="font-semibold text-[#111827]">Recent Agent Activity</h3>
                <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All</Link>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Agent</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2">Contact</th>
                    <th className="px-4 py-2">Outcome</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {ACTIVITY_ROWS.map((row) => (
                    <tr key={row.time + row.contact} className="hover:bg-[#f9fafb]">
                      <td className="px-4 py-3 text-[#6b7280]">{row.time}</td>
                      <td className="px-4 py-3 font-medium">{row.agent}</td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.priorityClass)}>{row.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.contact}</div>
                        <div className="text-[12px] text-[#6b7280]">{row.phone}</div>
                      </td>
                      <td className="px-4 py-3">{row.outcome}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3"><MoreHorizontal className="h-4 w-4 text-[#9ca3af]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="realtor-card p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Live Monitor</h3>
              <ul className="mt-3 space-y-2 text-[13px]">
                {["Speed-to-Lead", "Front Desk", "Knowledge Base"].map((agent) => (
                  <li key={agent} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {agent}
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Top Performing Agents</h3>
              <ul className="mt-3 space-y-2 text-[13px]">
                {[
                  { name: "Speed-to-Lead", score: "94%" },
                  { name: "Front Desk", score: "89%" },
                  { name: "Knowledge", score: "86%" },
                ].map((agent) => (
                  <li key={agent.name} className="flex justify-between">
                    <span>{agent.name}</span>
                    <span className="font-semibold text-emerald-600">{agent.score}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Active Pipeline</h3>
              <ul className="mt-3 space-y-2 text-[13px]">
                {[
                  { stage: "New Leads", count: 24 },
                  { stage: "In Progress", count: 12 },
                  { stage: "Qualified", count: 8 },
                  { stage: "Scheduled", count: 5 },
                ].map((item) => (
                  <li key={item.stage} className="flex justify-between">
                    <span>{item.stage}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Quick Actions</h3>
              <ul className="mt-3 space-y-2">
                {["Export Logs", "View Analytics", "Agent Settings"].map((action) => (
                  <li key={action}>
                    <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] hover:bg-[#f9fafb]">
                      {action}
                      <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="realtor-card p-8 text-center text-[#6b7280]">
          <Activity className="mx-auto h-8 w-8 text-[#9ca3af]" />
          <p className="mt-3 text-[15px] font-medium text-[#111827]">{tab}</p>
          <p className="mt-1 text-[13px]">View detailed {tab.toLowerCase()} in this section.</p>
        </div>
      )}
    </div>
  );
}
