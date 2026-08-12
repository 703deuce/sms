import { PIPELINE_COLUMNS } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import Link from "next/link";

export function PipelineBoardView() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Pipeline</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Visualize and manage your leads across every stage.
          </p>
        </div>
        <button type="button" className="realtor-btn-primary">
          + Add Lead
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="realtor-card flex flex-wrap gap-3 p-4">
        {["All Pipelines", "All Lead Types", "All Sources"].map((label) => (
          <select key={label} className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>{label}</option>
          </select>
        ))}
        <button type="button" className="realtor-btn-outline h-9">
          <SlidersHorizontal className="h-4 w-4" />
          More Filters
        </button>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input placeholder="Search pipeline..." className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-10 pr-3 text-[13px]" />
        </div>
        <div className="flex rounded-lg border border-[#e5e7eb] p-0.5">
          <button type="button" className="flex h-8 items-center gap-1 rounded-md bg-[#2563eb] px-3 text-[12px] font-semibold text-white">
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button type="button" className="flex h-8 items-center gap-1 rounded-md px-3 text-[12px] text-[#6b7280]">
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
        <button type="button" className="realtor-btn-outline h-9 px-2">
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_COLUMNS.map((col) => (
            <div key={col.id} className="min-w-[240px] flex-1">
              <div className={cn("rounded-t-lg px-3 py-2", col.tint)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[#111827]">{col.title}</h3>
                  <span className="text-[12px] text-[#6b7280]">{col.count}</span>
                </div>
                <p className="text-[12px] font-medium text-[#374151]">{col.value}</p>
              </div>
              <div className="space-y-2 rounded-b-lg border border-t-0 border-[#e5e7eb] bg-[#f9fafb] p-2 min-h-[320px]">
                {col.cards.map((card) => (
                  <div key={card.id} className="realtor-card relative p-3">
                    {card.starred ? (
                      <Star className="absolute right-2 top-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[11px] font-bold text-[#2563eb]">
                        {card.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                      </span>
                      <p className="font-semibold text-[#111827]">{card.name}</p>
                    </div>
                    <p className="mt-1 text-[12px] text-[#6b7280]">{card.meta}</p>
                    <p className="text-[12px] text-[#6b7280]">{card.location}</p>
                    <p className="text-[12px] text-[#374151]">{card.detail}</p>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">{card.time}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", card.badgeClass)}>
                        {card.badge}
                      </span>
                      <div className="flex gap-2 text-[#2563eb]">
                        <Phone className="h-3.5 w-3.5" />
                        <Mail className="h-3.5 w-3.5" />
                        <MoreHorizontal className="h-3.5 w-3.5 text-[#9ca3af]" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="flex w-full items-center justify-center gap-1 py-2 text-[12px] font-semibold text-[#2563eb]">
                  <Plus className="h-3.5 w-3.5" />
                  Add Lead
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="realtor-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">Pipeline Summary</h3>
              <select className="text-[11px] text-[#6b7280] border-0 bg-transparent">
                <option>This Month</option>
              </select>
            </div>
            <ul className="mt-3 space-y-2 text-[13px]">
              {PIPELINE_COLUMNS.map((col) => (
                <li key={col.id} className="flex justify-between">
                  <span className="text-[#374151]">{col.title}</span>
                  <span className="font-semibold text-[#111827]">
                    {col.count} <span className="font-normal text-[#6b7280]">{col.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="realtor-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">Conversion Rate</h3>
              <select className="text-[11px] text-[#6b7280] border-0 bg-transparent">
                <option>This Month</option>
              </select>
            </div>
            <p className="mt-3 text-[32px] font-bold text-[#111827]">29.4%</p>
            <p className="text-[12px] text-[#6b7280]">From New Lead to Closed</p>
            <div className="mt-2 h-2 rounded-full bg-[#e5e7eb]">
              <div className="h-full w-[29%] rounded-full bg-[#2563eb]" />
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">5 of 17 leads</p>
          </div>
          <div className="realtor-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">Top Sources</h3>
              <select className="text-[11px] text-[#6b7280] border-0 bg-transparent">
                <option>This Month</option>
              </select>
            </div>
            <ul className="mt-3 space-y-2 text-[12px]">
              {[
                ["Facebook", "42%", "bg-blue-500"],
                ["Website", "25%", "bg-sky-400"],
                ["Zillow", "15%", "bg-emerald-500"],
                ["Realtor.com", "10%", "bg-pink-400"],
                ["Other", "8%", "bg-gray-400"],
              ].map(([name, pct, color]) => (
                <li key={name} className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", color)} />
                  <span className="flex-1 text-[#374151]">{name}</span>
                  <span className="font-semibold">{pct}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/reports" className="realtor-btn-outline block w-full text-center">
            View Full Pipeline Report
          </Link>
        </div>
      </div>

      <div className="flex gap-6 text-[13px] text-[#6b7280]">
        <span>Total Leads: <strong className="text-[#111827]">63</strong></span>
        <span>Total Pipeline Value: <strong className="text-[#111827]">$29.6M</strong></span>
      </div>
    </div>
  );
}
