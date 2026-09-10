import type { AppointmentTypeConfig, StaffAssignmentMode } from "@/lib/appointments/types";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

const ASSIGNMENT_LABELS: Record<StaffAssignmentMode, string> = {
  any_eligible: "Any available host",
  customer_chooses: "Customer chooses host",
  round_robin: "Round robin",
  maximize_availability: "Any available host",
  specific_staff: "Specific hosts",
  collective: "All hosts required",
};

export function isMeetingRow(row: ApiTypeRow): boolean {
  return resolveBookingTypeKind(row.config) === "MEETING";
}

export function meetingMethodLabel(config?: AppointmentTypeConfig | null): string {
  const loc = config?.location?.trim();
  if (!loc) return "Not set";
  return loc;
}

export function hostAssignmentLabel(
  config?: AppointmentTypeConfig | null,
  staffNames?: Map<string, string>,
): string {
  const mode = config?.staffAssignment || "any_eligible";
  const base = ASSIGNMENT_LABELS[mode] || "Any available host";
  const ids =
    mode === "collective"
      ? config?.collectiveStaffIds || []
      : config?.staffIds || [];
  if (ids.length > 0 && staffNames) {
    const names = ids.map((id) => staffNames.get(id)).filter(Boolean);
    if (names.length > 0) return `${base} · ${names.join(", ")}`;
  }
  return base;
}

export function meetingIsActive(row: ApiTypeRow): boolean {
  return row.config?.enabled !== false && row.active !== false;
}

export function formatDurationMinutes(minutes: number): string {
  if (!minutes || minutes < 1) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function priceLabel(config?: AppointmentTypeConfig | null): string {
  const mode = config?.payment?.mode;
  if (!mode || mode === "none") return "Free";
  const cents = config?.payment?.priceCents ?? 0;
  if (cents <= 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function availabilityScheduleLabel(
  namedScheduleId: string,
  namedSchedules: Array<{ id: string; name: string }>,
): string {
  if (!namedScheduleId) return "Workspace default";
  return namedSchedules.find((s) => s.id === namedScheduleId)?.name || "Custom schedule";
}
