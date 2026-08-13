import { cn } from "@/lib/utils";
import type { StatusChip as Status } from "@/lib/types";

const styles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Scheduled: "bg-indigo-100 text-indigo-800",
  Sending: "bg-amber-100 text-amber-800",
  Completed: "bg-indigo-100 text-indigo-800",
  Failed: "bg-red-100 text-red-800",
  Paused: "bg-orange-100 text-orange-800",
  Canceled: "bg-slate-100 text-slate-600",
  Active: "bg-indigo-100 text-indigo-800",
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-indigo-100 text-indigo-800",
  Rejected: "bg-red-100 text-red-800",
  Open: "bg-indigo-100 text-indigo-800",
  Closed: "bg-slate-100 text-slate-600",
  Subscribed: "bg-indigo-100 text-indigo-800",
  Unsubscribed: "bg-orange-100 text-orange-800",
  Blocked: "bg-red-100 text-red-800",
  Invalid: "bg-rose-100 text-rose-800",
  Error: "bg-red-100 text-red-800",
  Archived: "bg-slate-100 text-slate-600",
  Complete: "bg-indigo-100 text-indigo-800",
  Mixed: "bg-amber-100 text-amber-800",
  Trial: "bg-indigo-100 text-indigo-800",
  Paid: "bg-indigo-100 text-indigo-800",
  Available: "bg-indigo-100 text-indigo-800",
  "Coming soon": "bg-indigo-50 text-indigo-700",
  Delivered: "bg-indigo-100 text-indigo-800",
  Low: "bg-indigo-100 text-indigo-800",
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
