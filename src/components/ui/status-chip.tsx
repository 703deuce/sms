import { cn } from "@/lib/utils";
import type { StatusChip as Status } from "@/lib/types";

const styles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-slate-600/10",
  Scheduled: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
  Sending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Failed: "bg-red-50 text-red-700 ring-red-600/15",
  Paused: "bg-orange-50 text-orange-800 ring-orange-600/20",
  Canceled: "bg-slate-100 text-slate-600 ring-slate-600/10",
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Rejected: "bg-red-50 text-red-700 ring-red-600/15",
  Open: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
  Closed: "bg-slate-100 text-slate-600 ring-slate-600/10",
  Subscribed: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Unsubscribed: "bg-orange-50 text-orange-800 ring-orange-600/20",
  Blocked: "bg-red-50 text-red-700 ring-red-600/15",
  Invalid: "bg-rose-50 text-rose-700 ring-rose-600/15",
  Error: "bg-red-50 text-red-700 ring-red-600/15",
  Archived: "bg-slate-100 text-slate-600 ring-slate-600/10",
  Complete: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Mixed: "bg-amber-50 text-amber-800 ring-amber-600/20",
  Trial: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Available: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  "Coming soon": "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Medium: "bg-amber-50 text-amber-800 ring-amber-600/20",
  High: "bg-red-50 text-red-700 ring-red-600/15",
};

const dotStyles: Record<string, string> = {
  Subscribed: "bg-emerald-500",
  Active: "bg-emerald-500",
  Completed: "bg-emerald-500",
  Complete: "bg-emerald-500",
  Approved: "bg-emerald-500",
  Delivered: "bg-emerald-500",
  Paid: "bg-emerald-500",
  Available: "bg-emerald-500",
  Open: "bg-indigo-500",
  Scheduled: "bg-indigo-500",
  Trial: "bg-indigo-500",
  Sending: "bg-amber-500",
  Pending: "bg-amber-500",
  Paused: "bg-orange-500",
  Unsubscribed: "bg-orange-500",
  Mixed: "bg-amber-500",
  Medium: "bg-amber-500",
  Failed: "bg-red-500",
  Rejected: "bg-red-500",
  Blocked: "bg-red-500",
  Invalid: "bg-rose-500",
  Error: "bg-red-500",
  High: "bg-red-500",
};

export function StatusChip({
  status,
  className,
}: {
  status: Status | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-semibold leading-4 ring-1 ring-inset",
        styles[status] ?? "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotStyles[status] ?? "bg-current opacity-60")}
        aria-hidden
      />
      <span className="truncate">{status}</span>
    </span>
  );
}
