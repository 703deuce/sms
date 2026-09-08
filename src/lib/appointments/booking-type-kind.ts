import type { AppointmentTypeConfig } from "@/lib/appointments/types";

/** Canonical booking archetype — one model, progressive disclosure per kind. */
export type BookingTypeKind = "MEETING" | "SERVICE" | "CLASS";

export const BOOKING_TYPE_KINDS: BookingTypeKind[] = ["MEETING", "SERVICE", "CLASS"];

export const BOOKING_TYPE_KIND_LABELS: Record<BookingTypeKind, string> = {
  MEETING: "Meeting",
  SERVICE: "Service",
  CLASS: "Class / Group",
};

export const BOOKING_TYPE_KIND_DESCRIPTIONS: Record<BookingTypeKind, string> = {
  MEETING: "Simple 1:1 scheduling — name, duration, location, availability.",
  SERVICE: "Paid or bookable services with payments, packages, recurrence, and resources.",
  CLASS: "Group sessions with capacity, roster, series enrollment, and waitlist.",
};

/** Resolve kind from config; legacy types without kind default to SERVICE. */
export function resolveBookingTypeKind(config?: AppointmentTypeConfig | null): BookingTypeKind {
  const raw = config?.bookingTypeKind;
  if (raw === "MEETING" || raw === "SERVICE" || raw === "CLASS") return raw;
  return "SERVICE";
}

export type BookingTypeKindFeatures = {
  showPayment: boolean;
  showRecurring: boolean;
  showGroupCapacity: boolean;
  showResources: boolean;
  showAddOns: boolean;
  showServicePhases: boolean;
  showPackageEligibility: boolean;
  showClassEnrollment: boolean;
};

/** Progressive disclosure — which editor sections apply per archetype. */
export function featuresForBookingTypeKind(kind: BookingTypeKind): BookingTypeKindFeatures {
  switch (kind) {
    case "MEETING":
      return {
        showPayment: false,
        showRecurring: false,
        showGroupCapacity: false,
        showResources: false,
        showAddOns: false,
        showServicePhases: false,
        showPackageEligibility: false,
        showClassEnrollment: false,
      };
    case "SERVICE":
      return {
        showPayment: true,
        showRecurring: true,
        showGroupCapacity: true,
        showResources: true,
        showAddOns: true,
        showServicePhases: true,
        showPackageEligibility: true,
        showClassEnrollment: false,
      };
    case "CLASS":
      return {
        showPayment: true,
        showRecurring: true,
        showGroupCapacity: true,
        showResources: false,
        showAddOns: false,
        showServicePhases: false,
        showPackageEligibility: true,
        showClassEnrollment: true,
      };
  }
}

/** Sensible defaults when switching kind during create. */
export function defaultConfigPatchForKind(kind: BookingTypeKind): Partial<AppointmentTypeConfig> {
  const base: Partial<AppointmentTypeConfig> = { bookingTypeKind: kind };
  if (kind === "CLASS") {
    return {
      ...base,
      groupBooking: { enabled: true, capacity: 10 },
      groupCapacity: 10,
    };
  }
  if (kind === "MEETING") {
    return {
      ...base,
      payment: { mode: "none" },
      recurring: { enabled: false },
      groupBooking: { enabled: false, capacity: 1 },
    };
  }
  return base;
}

export function bookingTypeKindBadgeClass(kind: BookingTypeKind): string {
  switch (kind) {
    case "MEETING":
      return "bg-sky-50 text-sky-700 ring-sky-600/20";
    case "SERVICE":
      return "bg-violet-50 text-violet-700 ring-violet-600/20";
    case "CLASS":
      return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }
}
