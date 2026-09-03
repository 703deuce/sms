"use client";

import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/appointments/types";

const toneMap: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  awaiting_confirmation: "bg-amber-100 text-amber-800",
  scheduled: "bg-sky-100 text-sky-800",
  reschedule_requested: "bg-orange-100 text-orange-800",
  canceled: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-200 text-slate-700",
  completed: "bg-violet-100 text-violet-700",
  no_show: "bg-rose-100 text-rose-700",
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
        toneMap[key] || "bg-slate-100 text-slate-700",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function formatAppointmentWhen(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
