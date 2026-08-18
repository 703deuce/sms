"use client";

import { CONNECTIONS_KPI, CONNECTIONS_ROWS } from "@/lib/realtor/appointments-crm-mock";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CrmKpiCard, CrmPageTabs } from "../shared/crm-page-tabs";

const CONN_TABS = [
  { label: "All Connections", count: 8 },
  { label: "Calendars", count: 3 },
  { label: "CRM", count: 2 },
  { label: "Phone", count: 2 },
  { label: "Messaging", count: 1 },
];

function ConnectionIcon({ icon }: { icon: string }) {
  const colors: Record<string, string> = {
    google: "bg-red-50 text-red-600",
    calendly: "bg-blue-50 text-blue-600",
    ghl: "bg-emerald-50 text-emerald-600",
    hubspot: "bg-orange-50 text-orange-600",
    twilio: "bg-red-50 text-red-600",
    telnyx: "bg-green-50 text-green-600",
    slack: "bg-purple-50 text-purple-600",
    gmail: "bg-blue-50 text-blue-600",
  };
  return (
    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold uppercase", colors[icon] ?? "bg-gray-100")}>
      {icon.slice(0, 2)}
    </span>
  );
}

export function ConnectionsView() {
  const [tab, setTab] = useState("All Connections");

  const filtered = useMemo(() => {
    if (tab === "All Connections") return CONNECTIONS_ROWS;
    const singular = tab.replace(/s$/, "");
    return CONNECTIONS_ROWS.filter((r) => r.category === tab || r.category === singular);
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Connections</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-[#6b7280]">
            Connect your tools and calendars so your AI agents can work seamlessly with your systems.
          </p>
        </div>
        <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
          <Plus className="h-4 w-4" />
          Add Connection
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="Total Connections" value={CONNECTIONS_KPI.total} hint="6 Active, 1 Expired, 1 Error" icon={Link2} tone="bg-purple-50 text-purple-600" />
        <CrmKpiCard label="Active" value={CONNECTIONS_KPI.active} hint="Connected and syncing" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <CrmKpiCard label="Expiring Soon" value={CONNECTIONS_KPI.expiring} hint="Requires reauthorization" icon={Clock} tone="bg-amber-50 text-amber-600" />
        <CrmKpiCard label="Connection Error" value={CONNECTIONS_KPI.errors} hint="Action required" icon={AlertCircle} tone="bg-red-50 text-red-600" />
      </div>

      <CrmPageTabs tabs={CONN_TABS} active={tab} onChange={setTab} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input placeholder="Search connections..." className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px]" />
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
              <th className="px-4 py-2">Connection</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Connected To</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Sync</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ConnectionIcon icon={row.icon} />
                    <div>
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-[12px] text-[#6b7280]">{row.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.categoryClass)}>{row.category}</span>
                </td>
                <td className="px-4 py-3 text-[#6b7280]">{row.connectedTo}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.statusClass)}>{row.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[#6b7280]">
                    {row.lastSync}
                    <RefreshCw className="h-3.5 w-3.5" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                      row.status === "Error"
                        ? "bg-red-50 text-red-700"
                        : row.status === "Expiring Soon"
                          ? "bg-amber-50 text-amber-700"
                          : "text-[#7c3aed] hover:bg-purple-50",
                    )}
                  >
                    {row.status === "Error" ? "Fix Connection" : row.status === "Expiring Soon" ? "Reauthorize" : "Manage"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Why connect your tools?</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-[#6b7280]">
            <li>• Real-time calendar syncing for accurate availability</li>
            <li>• Automatic lead pulling from your CRM</li>
            <li>• Consolidated communication across channels</li>
            <li>• Enable AI agent actions with your existing stack</li>
          </ul>
        </div>
        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Need help connecting?</h3>
          <p className="mt-2 text-[13px] text-[#6b7280]">
            Browse our step-by-step guides for each integration.
          </p>
          <button type="button" className="mt-3 text-[13px] font-semibold text-[#7c3aed]">View Connection Guides</button>
        </div>
      </div>
    </div>
  );
}
