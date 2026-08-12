import { NEEDS_ATTENTION_ITEMS } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Mail,
  PhoneOff,
  SlidersHorizontal,
  User,
} from "lucide-react";
import Link from "next/link";

const TABS = [
  { id: "all", label: "All", count: 8 },
  { id: "hot", label: "Hot Leads", count: 3 },
  { id: "human", label: "Requested Human", count: 2 },
  { id: "errors", label: "Errors", count: 2 },
  { id: "appts", label: "Appointments", count: 1 },
];

function ItemIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "flame":
      return <Flame className="h-4 w-4 text-red-500" />;
    case "alert":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "clock":
      return <Clock className="h-4 w-4 text-orange-500" />;
    case "bot":
      return <Bot className="h-4 w-4 text-purple-500" />;
    case "mail":
      return <Mail className="h-4 w-4 text-blue-500" />;
    case "phone-off":
      return <PhoneOff className="h-4 w-4 text-red-500" />;
    case "check":
      return <Check className="h-4 w-4 text-emerald-500" />;
    default:
      return <User className="h-4 w-4 text-orange-500" />;
  }
}

export function NeedsAttentionBoardView() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Needs Attention</h1>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-bold text-red-700">8</span>
            </div>
            <p className="mt-1 text-[15px] text-[#6b7280]">Items that need your review or action.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="realtor-btn-outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
            <button type="button" className="realtor-btn-outline">
              Sort: Newest
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-[13px] font-medium",
                i === 0
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {NEEDS_ATTENTION_ITEMS.map((item) => (
            <div
              key={item.id}
              className={cn("realtor-card flex gap-4 border-l-4 p-4", item.color)}
            >
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f9fafb]">
                <ItemIcon kind={item.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[11px] font-bold text-[#2563eb]">
                    {item.avatar}
                  </span>
                  <span className="font-semibold text-[#111827]">{item.name}</span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[12px] text-[#6b7280]">{item.detail}</p>
                <span className="mt-1 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                  {item.source}
                </span>
                <p className="mt-3 text-[14px] font-semibold text-[#111827]">{item.actionTitle}</p>
                <p className="text-[13px] text-[#6b7280]">{item.actionDetail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-[11px] text-[#9ca3af]">{item.time}</span>
                <button
                  type="button"
                  className={cn("rounded-lg border px-3 py-1.5 text-[12px] font-semibold", item.actionClass)}
                >
                  {item.actionLabel}
                </button>
                {item.secondaryLabel ? (
                  <Link href="/realtor/leads" className="text-[12px] font-semibold text-[#2563eb]">
                    {item.secondaryLabel}
                  </Link>
                ) : (
                  <Link href="/realtor/leads" className="text-[12px] font-semibold text-[#2563eb]">
                    View Lead
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Overview</h3>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-28 w-28 rounded-full border-[12px] border-red-400 border-r-orange-400 border-b-purple-400 border-l-emerald-400">
              <div className="flex h-full flex-col items-center justify-center">
                <p className="text-[24px] font-bold">8</p>
                <p className="text-[10px] text-[#6b7280]">Total</p>
              </div>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-[12px] text-[#374151]">
            <li className="flex justify-between"><span>Hot Leads</span><span className="font-semibold">3</span></li>
            <li className="flex justify-between"><span>Requested Human</span><span className="font-semibold">2</span></li>
            <li className="flex justify-between"><span>Errors</span><span className="font-semibold">2</span></li>
            <li className="flex justify-between"><span>Appointments</span><span className="font-semibold">1</span></li>
          </ul>
          <div className="mt-4 space-y-1 border-t border-[#e5e7eb] pt-3 text-[12px]">
            <p className="flex justify-between"><span>Avg. Response Time</span><span className="font-semibold text-emerald-600">1h 24m</span></p>
            <p className="flex justify-between"><span>Items Pending &gt; 24h</span><span className="font-semibold text-red-600">2</span></p>
          </div>
        </div>

        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Quick Actions</h3>
          <div className="mt-3 space-y-2">
            {["Call Queue (2)", "Send Broadcast SMS", "Create Follow-Up Task", "View Overdue Follow-Ups"].map(
              (label) => (
                <button key={label} type="button" className="realtor-btn-outline w-full justify-start text-[13px]">
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="realtor-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#111827]">AI Activity Snapshot</h3>
            <select className="text-[11px] border-0 bg-transparent text-[#6b7280]">
              <option>Today</option>
            </select>
          </div>
          <ul className="mt-3 space-y-2 text-[13px]">
            {[
              ["Calls Made", 42],
              ["Conversations", 38],
              ["Leads Qualified", 11],
              ["Appointments Booked", 5],
              ["Tasks Completed", 27],
            ].map(([label, val]) => (
              <li key={label as string} className="flex justify-between">
                <span className="text-[#374151]">{label}</span>
                <span className="font-semibold">{val}</span>
              </li>
            ))}
          </ul>
          <Link href="/realtor/agents/activity" className="mt-3 block text-[13px] font-semibold text-[#2563eb]">
            View Full AI Activity →
          </Link>
        </div>
      </div>
    </div>
  );
}
