import { Button } from "@/components/ui/button";
import type { RealtorLeadRow, RealtorLeadStatus } from "@/lib/realtor/types";
import { cn, formatPhone } from "@/lib/utils";
import { Download, MessageSquare, MoreHorizontal, Phone, Search, Upload } from "lucide-react";
import Link from "next/link";

const TABS: Array<{ id: string; label: string; href: string; dot?: string }> = [
  { id: "all", label: "All Leads", href: "/realtor/leads" },
  { id: "new", label: "New", href: "/realtor/leads?view=new" },
  { id: "hot", label: "Hot", href: "/realtor/leads?view=hot" },
  { id: "needs_attention", label: "Needs Attention", href: "/realtor/leads?view=needs_attention", dot: "orange" },
  { id: "qualified", label: "Qualified", href: "/realtor/leads?view=qualified", dot: "green" },
  { id: "appointments", label: "Appointments", href: "/realtor/leads?view=appointments", dot: "purple" },
  { id: "nurture", label: "Nurture", href: "/realtor/leads?view=nurture" },
  { id: "unqualified", label: "Unqualified", href: "/realtor/leads?view=closed" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function leadScore(lead: RealtorLeadRow): number {
  let score = 40;
  if (lead.status === "qualified" || lead.status === "appointment") score += 35;
  if (lead.collectedFields && Object.keys(lead.collectedFields).length > 3) score += 20;
  if (lead.needsAttention) score += 10;
  return Math.min(99, score);
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

function statusLabel(status: RealtorLeadStatus): string {
  return status.replace(/_/g, " ");
}

function statusDot(status: RealtorLeadStatus): string {
  switch (status) {
    case "qualified":
      return "bg-emerald-500";
    case "appointment":
      return "bg-purple-500";
    case "new":
      return "bg-blue-500";
    case "nurture":
      return "bg-amber-500";
    default:
      return "bg-orange-500";
  }
}

export function RealtorLeadsListView({
  leads,
  activeView,
  searchQuery,
  counts,
  total,
}: {
  leads: RealtorLeadRow[];
  activeView: string;
  searchQuery?: string;
  counts: Record<string, number>;
  total: number;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Leads</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            All your leads in one place. Filter, search, and take action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contacts/imports" className="realtor-btn-outline">
            <Upload className="h-4 w-4" />
            Import Leads
          </Link>
          <button type="button" className="realtor-btn-outline">
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link href="/realtor/test" className="realtor-btn-primary">
            + Add Lead
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
        {TABS.map((tab) => {
          const count = counts[tab.id] ?? (tab.id === "all" ? total : 0);
          const active = activeView === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium",
                active
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {tab.label}
              <span className="text-[12px]">{count}</span>
              {tab.dot ? (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    tab.dot === "orange" && "bg-orange-500",
                    tab.dot === "green" && "bg-emerald-500",
                    tab.dot === "purple" && "bg-purple-500",
                  )}
                />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="realtor-card p-4">
        <form action="/realtor/leads" method="get" className="flex flex-wrap gap-3">
          {activeView !== "all" ? <input type="hidden" name="view" value={activeView} /> : null}
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              name="q"
              value={searchQuery || ""}
              placeholder="Search leads..."
              className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-10 pr-3 text-[14px]"
            />
          </div>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>All Types</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>All Statuses</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>All Sources</option>
          </select>
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            <tr>
              <th className="px-4 py-3 w-8">
                <input type="checkbox" aria-label="Select all" />
              </th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Last Contact</th>
              <th className="px-4 py-3">Next Action</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb]">
            {leads.map((lead) => {
              const score = leadScore(lead);
              return (
                <tr key={lead.id} className="hover:bg-[#f9fafb]">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${lead.name}`} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/realtor/leads/${lead.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff6ff] text-[12px] font-bold text-[#2563eb]">
                        {initials(lead.name)}
                      </span>
                      <span>
                        <span className="font-semibold text-[#111827]">{lead.name}</span>
                        <br />
                        <span className="text-[12px] text-[#6b7280]">{formatPhone(lead.phone)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium capitalize text-blue-700">
                      {lead.intent || "Lead"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 capitalize">
                      <span className={`h-2 w-2 rounded-full ${statusDot(lead.status)}`} />
                      {statusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{lead.source || "—"}</td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {lead.lastActivityAt
                      ? new Date(lead.lastActivityAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-[12px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      {lead.needsAttention ? "Callback" : lead.status === "new" ? "Amy working" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{lead.assignedTo || "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${scoreColor(score)}`}>{score}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[#2563eb]">
                      <Link href={`/phone?contact=${lead.id}`}>
                        <Phone className="h-4 w-4" />
                      </Link>
                      <Link href={`/inbox?contact=${lead.id}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                      <button type="button" aria-label="More">
                        <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {leads.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-[#6b7280]">No leads in this view.</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
          <span>Showing 1 to {leads.length} of {total} leads</span>
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select className="rounded border border-[#e5e7eb] px-2 py-1">
              <option>25</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
