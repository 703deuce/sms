import { cn } from "./ui";

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    awaiting_confirmation: "Awaiting confirmation",
    reschedule_requested: "Reschedule requested",
    completed: "Completed",
    canceled: "Canceled",
    cancelled: "Canceled",
    no_show: "No-show",
  };
  return map[status.toLowerCase()] || status;
}

const toneMap: Record<string, { chip: string; dot: string }> = {
  confirmed: { chip: "chip-emerald", dot: "dot-emerald" },
  awaiting_confirmation: { chip: "chip-amber", dot: "dot-amber" },
  scheduled: { chip: "chip-sky", dot: "dot-sky" },
  reschedule_requested: { chip: "chip-orange", dot: "dot-orange" },
  canceled: { chip: "chip-slate", dot: "dot-slate" },
  cancelled: { chip: "chip-slate", dot: "dot-slate" },
  completed: { chip: "chip-violet", dot: "dot-violet" },
  no_show: { chip: "chip-rose", dot: "dot-rose" },
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const tone = toneMap[status.toLowerCase()] || {
    chip: "chip-slate",
    dot: "dot-slate",
  };
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

export function formatAppointmentDate(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAppointmentTime(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimezoneLabel(timezone?: string | null) {
  if (!timezone) return null;
  const parts = timezone.split("/");
  return parts[parts.length - 1]?.replace(/_/g, " ") || timezone;
}
