import { cn } from "@/lib/utils";
import type { StatusChip as Status } from "@/lib/types";

const styles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Scheduled: "bg-sky-100 text-sky-800",
  Sending: "bg-amber-100 text-amber-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Failed: "bg-red-100 text-red-800",
  Paused: "bg-orange-100 text-orange-800",
  Canceled: "bg-slate-100 text-slate-600",
  Active: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
  Open: "bg-sky-100 text-sky-800",
  Closed: "bg-slate-100 text-slate-600",
  Subscribed: "bg-emerald-100 text-emerald-800",
  Unsubscribed: "bg-orange-100 text-orange-800",
  Blocked: "bg-red-100 text-red-800",
  Invalid: "bg-rose-100 text-rose-800",
  Error: "bg-red-100 text-red-800",
  Archived: "bg-slate-100 text-slate-600",
  Complete: "bg-emerald-100 text-emerald-800",
  Mixed: "bg-amber-100 text-amber-800",
  Trial: "bg-sky-100 text-sky-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Available: "bg-emerald-100 text-emerald-800",
  "Coming soon": "bg-slate-100 text-slate-600",
  Delivered: "bg-emerald-100 text-emerald-800",
  Low: "bg-emerald-100 text-emerald-800",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-red-100 text-red-800",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}
