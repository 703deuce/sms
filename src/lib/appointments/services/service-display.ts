import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

export function isServiceRow(row: ApiTypeRow): boolean {
  return resolveBookingTypeKind(row.config) === "SERVICE";
}

export function serviceIsActive(row: ApiTypeRow): boolean {
  return row.config?.enabled !== false && row.active !== false;
}

export function servicePriceLabel(config?: AppointmentTypeConfig | null): string {
  const payment = config?.payment;
  if (!payment || payment.mode === "none") {
    const display = config?.priceDisplay?.trim();
    if (display) return display;
    return "Free";
  }
  if (payment.priceCents && payment.priceCents > 0) {
    return `$${(payment.priceCents / 100).toFixed(2)}`;
  }
  if (payment.mode === "deposit") return "Deposit";
  if (payment.mode === "full") return "Paid";
  return "—";
}

export function serviceDurationSummary(row: ApiTypeRow): string {
  const opts = row.config?.durationOptions?.filter((o) => o.active !== false) ?? [];
  if (opts.length > 1) {
    const mins = opts.map((o) => o.minutes).sort((a, b) => a - b);
    return `${mins[0]}–${mins[mins.length - 1]} min`;
  }
  return row.durationMinutes ? `${row.durationMinutes} min` : "—";
}

export function serviceStaffSummary(
  config?: AppointmentTypeConfig | null,
  staffNames?: Map<string, string>,
): string {
  const mode = config?.staffAssignment || "any_eligible";
  const labels: Record<string, string> = {
    any_eligible: "Any available",
    customer_chooses: "Customer chooses",
    round_robin: "Round robin",
    maximize_availability: "Any available",
    specific_staff: "Specific staff",
    collective: "All required",
  };
  const base = labels[mode] || "Any available";
  const ids =
    mode === "collective" ? config?.collectiveStaffIds || [] : config?.staffIds || [];
  if (ids.length > 0 && staffNames) {
    const names = ids.map((id) => staffNames.get(id)).filter(Boolean);
    if (names.length > 0) return `${base} · ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
  }
  return base;
}

export function serviceLocationSummary(
  config?: AppointmentTypeConfig | null,
  locationNames?: Map<string, string>,
): string {
  const ids = config?.locationIds || [];
  if (ids.length > 0 && locationNames) {
    const names = ids.map((id) => locationNames.get(id)).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (config?.locationId && locationNames?.get(config.locationId)) {
    return locationNames.get(config.locationId)!;
  }
  const loc = config?.location?.trim();
  return loc || "—";
}

export function visibilityLabel(config?: AppointmentTypeConfig | null): string {
  const v = config?.visibility || "public";
  return v.charAt(0).toUpperCase() + v.slice(1);
}
