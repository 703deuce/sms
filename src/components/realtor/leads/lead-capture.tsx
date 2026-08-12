import { CAPTURE_METHODS } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  FileText,
  Globe,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

const TABS = ["Capture Methods", "Forms", "Landing Pages", "Pop-ups", "Webhooks"];

export function LeadCaptureView() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Lead Capture</h1>
            <p className="mt-1 text-[15px] text-[#6b7280]">
              Capture leads from any channel and add them directly to your CRM.
            </p>
          </div>
          <button type="button" className="realtor-btn-primary">
            <Plus className="h-4 w-4" />
            Add Capture Method
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Methods", value: 7, sub: "Live and capturing", icon: FileText, tone: "bg-purple-50 text-purple-600" },
            { label: "Total Captures", value: "2,487", sub: "This month", icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" },
            { label: "Conversion Rate", value: "18.6%", sub: "↑ 2.4% vs last month", icon: TrendingUp, tone: "bg-orange-50 text-orange-600" },
            { label: "Leads Created", value: "1,892", sub: "This month", icon: Users, tone: "bg-blue-50 text-blue-600" },
          ].map((card) => (
            <div key={card.label} className="realtor-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] text-[#6b7280]">{card.label}</p>
                  <p className="mt-2 text-[28px] font-bold text-[#111827]">{card.value}</p>
                  <p className="text-[12px] text-emerald-600">{card.sub}</p>
                </div>
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", card.tone)}>
                  <card.icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-[13px] font-medium",
                i === 0
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="realtor-card p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input placeholder="Search capture methods..." className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-10 pr-3 text-[14px]" />
            </div>
            <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
              <option>All Status</option>
            </select>
            <button type="button" className="realtor-btn-outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        <div className="realtor-card overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Source/Location</th>
                <th className="px-4 py-3">Leads (30d)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {CAPTURE_METHODS.map((row) => (
                <tr key={row.id} className="hover:bg-[#f9fafb]">
                  <td className="px-4 py-3 font-semibold text-[#111827]">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", row.typeClass)}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{row.source}</td>
                  <td className="px-4 py-3 font-semibold">{row.leads}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">{row.created}</td>
                  <td className="px-4 py-3">
                    <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                  </td>
                </tr>
              ))}
              <tr className="border-t border-dashed border-[#e5e7eb]">
                <td className="px-4 py-4" colSpan={7}>
                  <button type="button" className="flex items-center gap-2 text-[13px] font-semibold text-[#2563eb]">
                    <Plus className="h-4 w-4" />
                    Add Capture Method
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
            Showing 1 to 7 of 7 methods
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Capture Channels</h3>
          <ul className="mt-3 space-y-2 text-[13px]">
            {[
              { icon: FileText, label: "Forms", count: "2 active", color: "text-purple-600" },
              { icon: Globe, label: "Landing Pages", count: "1 active", color: "text-emerald-600" },
              { icon: Layers, label: "Integrations", count: "3 active", color: "text-blue-600" },
              { icon: MessageSquare, label: "SMS", count: "1 active", color: "text-orange-600" },
            ].map((item) => (
              <li key={item.label}>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#f9fafb]">
                  <item.icon className={cn("h-4 w-4", item.color)} />
                  <span className="flex-1 text-left text-[#374151]">{item.label}</span>
                  <span className="text-[12px] text-[#6b7280]">{item.count}</span>
                  <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                </button>
              </li>
            ))}
          </ul>
          <Link href="#" className="mt-3 block text-[13px] font-semibold text-[#2563eb]">
            View all channels →
          </Link>
        </div>

        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Capture Insights (30 Days)</h3>
          <ul className="mt-3 space-y-3 text-[13px]">
            <li>
              <p className="text-[#6b7280]">Top Source</p>
              <p className="font-semibold text-[#111827]">Facebook Lead Ads</p>
            </li>
            <li>
              <p className="text-[#6b7280]">Best Converting</p>
              <p className="font-semibold text-[#111827]">Home Valuation Page (27.4%)</p>
            </li>
            <li>
              <p className="text-[#6b7280]">Most Leads</p>
              <p className="font-semibold text-[#111827]">Facebook Lead Ads (673)</p>
            </li>
          </ul>
        </div>

        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Recent Captures</h3>
          <ul className="mt-3 space-y-3 text-[13px]">
            {[
              ["John Smith", "Facebook Lead Ads", "2 min ago"],
              ["Emily Davis", "Website Contact Form", "15 min ago"],
              ["Michael Brown", "Text-to-Lead", "28 min ago"],
            ].map(([name, source, time]) => (
              <li key={name} className="flex justify-between gap-2">
                <span>
                  <span className="font-semibold text-[#111827]">{name}</span>
                  <br />
                  <span className="text-[12px] text-[#6b7280]">{source}</span>
                </span>
                <span className="text-[12px] text-[#9ca3af]">{time}</span>
              </li>
            ))}
          </ul>
          <Link href="/realtor/leads" className="mt-3 block text-[13px] font-semibold text-[#2563eb]">
            View all captures →
          </Link>
        </div>
      </div>
    </div>
  );
}
