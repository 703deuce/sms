import type { CalendarViewMode } from "./types";
import type { CalendarFilters } from "@/components/appointments/calendar/calendar-filter-bar";
import { dateKey, startOfWeek } from "./map-calendar";

export function parseCalendarView(raw: string | null): CalendarViewMode {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "agenda") return raw;
  return "week";
}

export function parseCalendarFiltersFromSearch(params: URLSearchParams): CalendarFilters {
  return {
    q: params.get("q") || "",
    staffIds: (params.get("staff") || "").split(",").filter(Boolean),
    locationId: params.get("location") || "",
    resourceId: params.get("resource") || "",
    status: params.get("status") || "all",
    domainType: params.get("type") || "all",
  };
}

export function parseCalendarCursorFromSearch(
  params: URLSearchParams,
  view: CalendarViewMode,
): Date {
  const raw = params.get("date");
  if (raw) {
    const d = new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return view === "week" ? startOfWeek(d) : d;
    }
  }
  const today = new Date();
  return view === "week" ? startOfWeek(today) : today;
}

export function buildCalendarSearchParams(input: {
  view: CalendarViewMode;
  cursor: Date;
  selectedDayKey: string;
  filters: CalendarFilters;
}): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", input.view);
  const dateSource =
    input.view === "day" || input.view === "agenda"
      ? new Date(input.selectedDayKey)
      : input.cursor;
  p.set("date", dateSource.toISOString().slice(0, 10));
  if (input.filters.q) p.set("q", input.filters.q);
  if (input.filters.staffIds.length) p.set("staff", input.filters.staffIds.join(","));
  if (input.filters.locationId) p.set("location", input.filters.locationId);
  if (input.filters.resourceId) p.set("resource", input.filters.resourceId);
  if (input.filters.status !== "all") p.set("status", input.filters.status);
  if (input.filters.domainType !== "all") p.set("type", input.filters.domainType);
  return p;
}

export function calendarUrlEquals(a: URLSearchParams, b: URLSearchParams) {
  const sa = a.toString();
  const sb = b.toString();
  return sa === sb;
}

export function selectedDayFromCursor(cursor: Date, view: CalendarViewMode) {
  return dateKey(view === "week" ? cursor : cursor);
}
