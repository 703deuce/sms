import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { resolveClassPresentation } from "@/lib/appointments/booking-types-segments";
import { visibilityLabel } from "@/lib/appointments/services/service-display";

export type ClassSeriesRow = {
  id: string;
  name: string;
  appointmentTypeId?: string | null;
  capacity: number;
  staffId?: string | null;
  locationId?: string | null;
  active?: boolean;
  occurrences?: Array<{
    id: string;
    startsAt: string | Date;
    endsAt: string | Date;
    capacity?: number | null;
    status: string;
    enrollments?: Array<{ id: string; status: string }>;
  }>;
};

export function isClassTypeRow(row: ApiTypeRow): boolean {
  return resolveBookingTypeKind(row.config) === "CLASS";
}

export function isRecurringClassRow(row: ApiTypeRow): boolean {
  return isClassTypeRow(row) && resolveClassPresentation(row.config) !== "workshop_event";
}

export function isWorkshopEventRow(row: ApiTypeRow): boolean {
  return isClassTypeRow(row) && resolveClassPresentation(row.config) === "workshop_event";
}

export function classIsActive(row: ApiTypeRow): boolean {
  return row.config?.enabled !== false && row.active !== false;
}

export function classCapacityLabel(config?: AppointmentTypeConfig | null): string {
  const cap = config?.groupBooking?.capacity;
  return cap != null ? String(cap) : "—";
}

export function instructorLabel(
  staffId?: string | null,
  staffNames?: Map<string, string>,
): string {
  if (!staffId) return "—";
  return staffNames?.get(staffId) || "Assigned";
}

export function locationLabel(
  locationId?: string | null,
  locationNames?: Map<string, string>,
): string {
  if (!locationId) return "—";
  return locationNames?.get(locationId) || "Assigned";
}

export function nextOccurrenceSummary(series?: ClassSeriesRow | null): string {
  if (!series?.occurrences?.length) return "—";
  const now = Date.now();
  const upcoming = series.occurrences
    .filter((o) => o.status === "scheduled" && new Date(o.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const next = upcoming[0];
  if (!next) return "No upcoming";
  const d = new Date(next.startsAt);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function scheduleSummaryForClass(series?: ClassSeriesRow | null): string {
  if (!series?.occurrences?.length) return "Not scheduled";
  const count = series.occurrences.filter((o) => o.status === "scheduled").length;
  if (count > 1) return `${count} upcoming sessions`;
  return nextOccurrenceSummary(series);
}

export function enrolledCount(series?: ClassSeriesRow | null, occurrenceId?: string): string {
  if (!series?.occurrences?.length) return "—";
  const occ = occurrenceId
    ? series.occurrences.find((o) => o.id === occurrenceId)
    : series.occurrences
        .filter((o) => o.status === "scheduled")
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  if (!occ) return "0";
  const enrolled = (occ.enrollments || []).filter((e) => e.status === "enrolled").length;
  const cap = occ.capacity ?? series.capacity;
  return `${enrolled} / ${cap}`;
}

export { visibilityLabel };
