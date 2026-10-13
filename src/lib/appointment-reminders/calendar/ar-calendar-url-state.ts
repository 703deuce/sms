import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

/** Unified Appointments home defaults to agenda; other views via `?view=`. */
export function parseArCalendarView(raw: string | null): CalendarViewMode {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "agenda") return raw;
  return "agenda";
}
