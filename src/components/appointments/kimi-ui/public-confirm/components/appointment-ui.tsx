import type { ReactElement } from "react";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  awaiting_confirmation: "Awaiting confirmation",
  reschedule_requested: "Reschedule requested",
  canceled: "Canceled",
  cancelled: "Canceled",
  completed: "Completed",
  no_show: "No-show",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status.toLowerCase()] || "Scheduled";
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span className={`status-badge status-${key}`}>
      <span className="status-dot" aria-hidden="true" />
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

export function formatAppointmentDay(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTimezoneAbbrev(iso: string, timezone?: string | null) {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date(iso));
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return timezone;
  }
}

export function CalendarCheckIcon({ size = 18 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export function CheckIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

export function VideoIcon({ size = 16 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 10 6-3v10l-6-3" />
      <rect width="14" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}

export function AlertIcon({ size = 16 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  );
}
