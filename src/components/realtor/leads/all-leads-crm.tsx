import { CRM_KPI, CRM_LEADS } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  Download,
  LayoutGrid,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

function KpiCard({
  label,
  value,
  hint,
  hintUp,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  hintUp?: boolean;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="realtor-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
          <p className="mt-2 text-[28px] font-bold text-[#111827]">{value.toLocaleString()}</p>
          <p className={cn("mt-1 flex items-center gap-1 text-[12px]", hintUp ? "text-emerald-600" : "text-red-600")}>
            {hintUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {hint}
          </p>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

export function AllLeadsCrmView() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">All Leads</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Manage and follow up with all of your leads in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="realtor-btn-outline">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="realtor-btn-outline">
            More Actions
            <ChevronDown className="h-4 w-4" />
          </button>
          <Link href="/contacts/new" className="realtor-btn-primary">
            + Add Lead
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Leads" value={CRM_KPI.totalLeads} hint="↑ 18% vs last month" hintUp icon={Users} tone="bg-blue-50 text-blue-600" />
        <KpiCard label="New Leads" value={CRM_KPI.newLeads} hint="↑ 22% vs last month" hintUp icon={UserPlus} tone="bg-teal-50 text-teal-600" />
        <KpiCard label="Contacted" value={CRM_KPI.contacted} hint="↑ 15% vs last month" hintUp icon={Phone} tone="bg-purple-50 text-purple-600" />
        <KpiCard label="Qualified" value={CRM_KPI.qualified} hint="↑ 12% vs last month" hintUp icon={Calendar} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Won" value={CRM_KPI.won} hint="↑ 10% vs last month" hintUp icon={TrendingUp} tone="bg-orange-50 text-orange-600" />
        <KpiCard label="Lost" value={CRM_KPI.lost} hint="↑ 5% vs last month" hintUp={false} icon={TrendingDown} tone="bg-red-50 text-red-600" />
      </div>

      <div className="realtor-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              placeholder="Search leads..."
              className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-10 pr-3 text-[14px]"
            />
          </div>
          {["All Lists", "All Tags", "All Sources", "All Owners"].map((label) => (
            <select key={label} className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
              <option>{label}</option>
            </select>
          ))}
          <button type="button" className="realtor-btn-outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[10px] font-bold text-white">
              2
            </span>
          </button>
          <button type="button" className="realtor-btn-outline">
            <LayoutGrid className="h-4 w-4" />
            Columns
          </button>
        </div>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            <tr>
              <th className="w-8 px-4 py-3"><input type="checkbox" aria-label="Select all" /></th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact Info</th>
              <th className="px-4 py-3">Lead Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {CRM_LEADS.map((lead) => (
              <tr key={lead.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${lead.name}`} /></td>
                <td className="px-4 py-3">
                  <Link href={`/realtor/leads/${lead.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff6ff] text-[12px] font-bold text-[#2563eb]">
                      {lead.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <span>
                      <span className="font-semibold text-[#111827]">{lead.name}</span>
                      <br />
                      <span className="text-[12px] text-[#6b7280]">{lead.company}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-[12px] text-[#374151]">
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-[#9ca3af]" />{lead.phone}</div>
                  <div className="mt-1 flex items-center gap-1"><Mail className="h-3 w-3 text-[#9ca3af]" />{lead.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-[22px] font-bold", scoreColor(lead.score))}>{lead.score}</span>
                  <span className="ml-1 text-[12px] text-[#6b7280]">{lead.scoreLabel}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", lead.statusClass)}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[#111827]">{lead.source}</div>
                  <div className="text-[12px] text-[#6b7280]">{lead.sourceDetail}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-bold">
                      {lead.ownerInitials}
                    </span>
                    <span className="text-[#374151]">{lead.owner}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[#111827]">{lead.lastActivity}</div>
                  <div className="text-[12px] text-[#6b7280]">{lead.lastActivityDetail}</div>
                </td>
                <td className="px-4 py-3 text-[#6b7280]">{lead.created}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[#2563eb]">
                    <Phone className="h-4 w-4" />
                    <Mail className="h-4 w-4" />
                    <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
          <span>Showing 1 to 8 of 2,487 leads</span>
          <div className="flex items-center gap-2">
            <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[12px]">
              <option>25 per page</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">‹</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white">1</span>
              <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]">2</Link>
              <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]">3</Link>
              <span className="px-1">…</span>
              <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]">100</Link>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]">›</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
