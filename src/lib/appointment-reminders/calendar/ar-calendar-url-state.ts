import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

/** AR read-only calendar defaults to month (full calendar grid). */
export function parseArCalendarView(raw: string | null): CalendarViewMode {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "agenda") return raw;
  return "month";
}
