import { LeadsExportButton } from "@/components/realtor/leads-export-button";
import type { RealtorLeadRow, RealtorLeadStatus } from "@/lib/realtor/types";
import { cn, formatPhone } from "@/lib/utils";
import {
  MessageSquare,
  MoreHorizontal,
  Phone,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
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

function scoreRingColor(score: number): string {
  if (score >= 80) return "#6366f1";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function statusLabel(status: RealtorLeadStatus): string {
  const map: Record<string, string> = {
    new: "New",
    working: "Working",
    contacted: "Contacted",
    qualified: "Qualified",
    appointment: "Appointment",
    nurture: "Nurture",
    closed: "Unqualified",
  };
  return map[status] || status.replace(/_/g, " ");
}

function statusDot(status: RealtorLeadStatus): string {
  switch (status) {
    case "qualified":
      return "bg-violet-500";
    case "appointment":
      return "bg-purple-500";
    case "new":
      return "bg-indigo-500";
    case "nurture":
      return "bg-amber-500";
    case "closed":
      return "bg-gray-400";
    default:
      return "bg-orange-500";
  }
}

function intentBadge(intent?: string | null): { label: string; className: string } {
  const key = (intent || "").toLowerCase();
  if (key.includes("seller")) {
    return { label: "Seller", className: "bg-purple-50 text-purple-700" };
  }
  if (key.includes("buyer")) {
    return { label: "Buyer", className: "bg-indigo-50 text-indigo-700" };
  }
  if (key.includes("agent")) {
    return { label: "Other Agent", className: "bg-orange-50 text-orange-700" };
  }
  return { label: intent || "Lead", className: "bg-gray-100 text-gray-700" };
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sourceLabel(source?: string | null): string {
  if (!source) return "—";
  if (source.includes("facebook")) return "Facebook Lead";
  if (source.includes("zillow")) return "Zillow";
  if (source.includes("website")) return "Website";
  return source.replace(/^crm:/, "").replace(/_/g, " ");
}

function buildPageHref(
  base: { view?: string; q?: string; perPage?: number },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.view && base.view !== "all") params.set("view", base.view);
  if (base.q) params.set("q", base.q);
  if (base.perPage && base.perPage !== 25) params.set("perPage", String(base.perPage));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/realtor/leads?${qs}` : "/realtor/leads";
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreRingColor(score);
  const pct = score;
  return (
    <div
      className="relative flex h-9 w-9 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, #e5e7eb ${pct * 3.6}deg)`,
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#111827]"
      >
        {score}
      </span>
    </div>
  );
}

export function RealtorLeadsListView({
  leads,
  activeView,
  searchQuery,
  counts,
  total,
  page = 1,
  perPage = 25,
}: {
  leads: RealtorLeadRow[];
  activeView: string;
  searchQuery?: string;
  counts: Record<string, number>;
  total: number;
  page?: number;
  perPage?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const pageBase = { view: activeView, q: searchQuery, perPage };

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
          <LeadsExportButton leads={leads} />
          <Link href="/contacts/create" className="realtor-btn-primary">
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
                  ? "border-[#6366f1] text-[#6366f1]"
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
                    tab.dot === "green" && "bg-violet-500",
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
              defaultValue={searchQuery || ""}
              placeholder="Search leads..."
              className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-10 pr-3 text-[14px] outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
            />
          </div>
          <select name="type" className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
            <option value="">All Types</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
          <select name="status" className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="appointment">Appointment</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
            <option>All Sources</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
            <option>All</option>
          </select>
          <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px] text-[#374151]">
            <option>This Week</option>
          </select>
          <button type="button" className="realtor-btn-outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </form>
      </div>

      <div className="realtor-card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
            <tr>
              <th className="w-8 px-4 py-3">
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
              const badge = intentBadge(lead.intent);
              const lastIcon = lead.lastActivityAt && lead.phone?.startsWith("+") ? Phone : MessageSquare;
              const LastIcon = lastIcon;
              return (
                <tr key={lead.id} className="hover:bg-[#f9fafb]">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${lead.name}`} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/realtor/leads/${lead.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff6ff] text-[12px] font-bold text-[#6366f1]">
                        {initials(lead.name)}
                      </span>
                      <span>
                        <span className="font-semibold text-[#111827]">{lead.name}</span>
                        <br />
                        <span className="text-[12px] text-[#6b7280]">
                          {lead.phone?.startsWith("+") ? formatPhone(lead.phone) : lead.phone}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusDot(lead.status)}`} />
                      <span className="capitalize">{statusLabel(lead.status)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{sourceLabel(lead.source)}</td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    <span className="inline-flex items-center gap-1.5">
                      <LastIcon className="h-3.5 w-3.5" />
                      {timeAgo(lead.lastActivityAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          lead.needsAttention ? "bg-orange-500" : "bg-violet-500",
                        )}
                      />
                      {lead.needsAttention
                        ? "Callback Today"
                        : lead.status === "new"
                          ? "Call Now Attempt 1"
                          : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">
                    {lead.assignedTo || (
                      <span className="text-[#9ca3af]">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreRing score={score} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[#6366f1]">
                      <Link href={`/phone?contact=${lead.id}`} aria-label="Call">
                        <Phone className="h-4 w-4" />
                      </Link>
                      <Link href={`/conversations?contact=${lead.id}`} aria-label="Message">
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                      <Link href={`/realtor/leads/${lead.id}`} aria-label="More">
                        <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                      </Link>
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
          <span>
            Showing {total === 0 ? 0 : start} to {end} of {total} leads
          </span>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={buildPageHref(pageBase, page - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
              >
                ‹
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">
                ‹
              </span>
            )}
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildPageHref(pageBase, p)}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2",
                  p === page
                    ? "border-[#6366f1] bg-[#6366f1] text-white"
                    : "border-[#e5e7eb] hover:bg-[#f9fafb]",
                )}
              >
                {p}
              </Link>
            ))}
            {totalPages > 3 ? (
              <>
                <span className="px-1">…</span>
                <Link
                  href={buildPageHref(pageBase, totalPages)}
                  className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
                >
                  {totalPages}
                </Link>
              </>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildPageHref(pageBase, page + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
              >
                ›
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">
                ›
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Link
              href={buildPageHref({ ...pageBase, perPage: 25 }, 1)}
              className={cn(
                "rounded border px-2 py-1",
                perPage === 25 ? "border-[#6366f1] text-[#6366f1]" : "border-[#e5e7eb]",
              )}
            >
              25
            </Link>
            <Link
              href={buildPageHref({ ...pageBase, perPage: 50 }, 1)}
              className={cn(
                "rounded border px-2 py-1",
                perPage === 50 ? "border-[#6366f1] text-[#6366f1]" : "border-[#e5e7eb]",
              )}
            >
              50
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
