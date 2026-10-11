import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

/** AR calendar workspace defaults to week (operational home). */
export function parseArCalendarView(raw: string | null): CalendarViewMode {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "agenda") return raw;
  return "week";
}
