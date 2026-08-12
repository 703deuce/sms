"use client";

import {
  KNOWLEDGE_ACTIVITY,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_KPI,
  KNOWLEDGE_SOURCES,
  KNOWLEDGE_STATUS,
} from "@/lib/realtor/agents-crm-mock";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Clock,
  FileText,
  Link2,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentKpiCard, AgentPageTabs } from "./agent-page-tabs";

const TABS = ["Overview", "Source", "Categories", "FAQ", "Test the Agent", "Settings"];

export function KnowledgeAgentView() {
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Knowledge</h1>
            <span className="text-[14px] text-[#6b7280]">{KNOWLEDGE_KPI.totalItems} items</span>
          </div>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Manage your knowledge base for your AI Agent to provide accurate responses.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="realtor-btn-outline">Select date</button>
          <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Source
          </button>
        </div>
      </div>

      <AgentPageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <AgentKpiCard label="Total Items" value={KNOWLEDGE_KPI.totalItems} hint="↑ 12% from last month" icon={FileText} tone="bg-purple-50 text-purple-600" />
              <AgentKpiCard label="Total Records" value={KNOWLEDGE_KPI.totalRecords} hint="↑ 8% from last month" icon={BookOpen} tone="bg-emerald-50 text-emerald-600" />
              <AgentKpiCard label="Authors" value={KNOWLEDGE_KPI.authors} hint="↑ 0% from last month" icon={Users} tone="bg-blue-50 text-blue-600" />
              <AgentKpiCard label="Read Time" value={KNOWLEDGE_KPI.readTime} hint="↑ 5% from last month" icon={Clock} tone="bg-amber-50 text-amber-600" />
              <AgentKpiCard label="Completed" value={KNOWLEDGE_KPI.completed} hint="On track" icon={Sparkles} tone="bg-pink-50 text-pink-600" />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="realtor-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                  <h3 className="font-semibold text-[#111827]">Knowledge Sources</h3>
                  <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All</Link>
                </div>
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Size</th>
                      <th className="px-4 py-2">Date Added</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {KNOWLEDGE_SOURCES.map((row) => (
                      <tr key={row.name} className="hover:bg-[#f9fafb]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium">
                            {row.type === "Link" ? <Link2 className="h-4 w-4 text-[#7c3aed]" /> : <FileText className="h-4 w-4 text-[#6b7280]" />}
                            {row.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6b7280]">{row.type}</td>
                        <td className="px-4 py-3 text-[#6b7280]">{row.size}</td>
                        <td className="px-4 py-3 text-[#6b7280]">{row.date}</td>
                        <td className="px-4 py-3"><MoreHorizontal className="h-4 w-4 text-[#9ca3af]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="realtor-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#111827]">Top Knowledge Categories</h3>
                  <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All</Link>
                </div>
                <div className="mt-4 flex items-center gap-6">
                  <div className="relative h-32 w-32 shrink-0">
                    <div className="absolute inset-0 rounded-full border-[12px] border-purple-500 border-r-blue-500 border-b-emerald-500 border-l-orange-400" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[16px] font-bold">240</span>
                      <span className="text-[10px] text-[#6b7280]">items</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-[12px]">
                    {KNOWLEDGE_CATEGORIES.map((cat) => (
                      <li key={cat.label} className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", cat.color)} />
                        {cat.label} <span className="text-[#6b7280]">({cat.count})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="realtor-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                  <h3 className="font-semibold text-[#111827]">Recent Knowledge Activity</h3>
                  <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All</Link>
                </div>
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
                    <tr>
                      <th className="px-4 py-2">Source</th>
                      <th className="px-4 py-2">Activity</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">By Who</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {KNOWLEDGE_ACTIVITY.map((row) => (
                      <tr key={row.source + row.date} className="hover:bg-[#f9fafb]">
                        <td className="px-4 py-3 font-medium">{row.source}</td>
                        <td className="px-4 py-3">{row.activity}</td>
                        <td className="px-4 py-3 text-[#6b7280]">{row.date}</td>
                        <td className="px-4 py-3">{row.by}</td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="realtor-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#111827]">Knowledge Status</h3>
                  <Link href="#" className="text-[13px] font-semibold text-[#7c3aed]">View All</Link>
                </div>
                <ul className="mt-4 space-y-4">
                  {KNOWLEDGE_STATUS.map((item) => (
                    <li key={item.label}>
                      <div className="mb-1 flex justify-between text-[12px]">
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                        <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="realtor-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#111827]">Knowledge Agent</h3>
                <Settings className="h-4 w-4 text-[#9ca3af]" />
              </div>
              <div className="mt-4 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Sparkles className="h-8 w-8" />
                </span>
                <h4 className="mt-3 text-[16px] font-bold">Knowledge Agent</h4>
                <p className="text-[12px] text-[#6b7280]">support@ai.com</p>
                <p className="mt-1 text-[12px] text-[#7c3aed]">Always looking to help</p>
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                {[
                  ["Knowledge Agent Type", "Internal Assistant"],
                  ["Knowledge base URL", "example.com/kb"],
                  ["Source", "24 Documents"],
                  ["Last update", "Oct 12, 2024, 10:25 AM"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-[#6b7280]">{k}</dt>
                    <dd className="text-right font-medium text-[#111827]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Test The Knowledge</h3>
              <p className="mt-2 text-[13px] text-[#6b7280]">
                Open the chat interface to test how your agent responds using the knowledge base.
              </p>
              <Link href="/realtor/test" className="realtor-btn-primary mt-3 w-full bg-[#7c3aed] hover:bg-[#6d28d9]">
                Open Chat Interface
              </Link>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Need Help?</h3>
              <p className="mt-2 text-[13px] text-[#6b7280]">
                Watch our tutorial on setting up and managing your knowledge base.
              </p>
              <Link href="#" className="mt-2 block text-[13px] font-semibold text-[#7c3aed]">View Tutorial Video</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="realtor-card p-8 text-center text-[#6b7280]">
          <BookOpen className="mx-auto h-8 w-8 text-[#9ca3af]" />
          <p className="mt-3 text-[15px] font-medium text-[#111827]">{tab}</p>
          <p className="mt-1 text-[13px]">Configure this section in knowledge settings.</p>
        </div>
      )}
    </div>
  );
}
