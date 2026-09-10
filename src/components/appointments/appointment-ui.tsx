"use client";

import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/appointments/types";

const toneMap: Record<string, { chip: string; dot: string }> = {
  confirmed: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    dot: "bg-emerald-500",
  },
  awaiting_confirmation: {
    chip: "bg-amber-50 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  scheduled: {
    chip: "bg-sky-50 text-sky-800 ring-sky-600/15",
    dot: "bg-sky-500",
  },
  reschedule_requested: {
    chip: "bg-orange-50 text-orange-800 ring-orange-600/20",
    dot: "bg-orange-500",
  },
  canceled: {
    chip: "bg-slate-100 text-slate-600 ring-slate-500/15",
    dot: "bg-slate-400",
  },
  cancelled: {
    chip: "bg-slate-100 text-slate-600 ring-slate-500/15",
    dot: "bg-slate-400",
  },
  completed: {
    chip: "bg-[#dcefeb] text-[#10665f] ring-[#147d74]/15",
    dot: "bg-[#147d74]",
  },
  no_show: {
    chip: "bg-rose-50 text-rose-700 ring-rose-600/15",
    dot: "bg-rose-500",
  },
};

export function appointmentTone(status: string) {
  const key = status.toLowerCase();
  return (
    toneMap[key] || {
      chip: "bg-slate-100 text-slate-600 ring-slate-500/15",
      dot: "bg-slate-400",
    }
  );
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  const tone = appointmentTone(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ring-inset",
        tone.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
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

export function formatAppointmentTime(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAppointmentDate(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAppointmentDay(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
