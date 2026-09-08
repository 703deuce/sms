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
  MEETING:
    "Lightweight scheduling by default — name, duration, location, availability, host. Advanced options available.",
  SERVICE:
    "Service-business defaults — price, recurrence, packages, resources, add-ons, and more in advanced settings.",
  CLASS:
    "Group defaults — capacity, provider, schedule, enrollment. Payments, resources, add-ons, and intake remain available.",
};

/** Resolve kind from config; legacy types without kind default to SERVICE. */
export function resolveBookingTypeKind(config?: AppointmentTypeConfig | null): BookingTypeKind {
  const raw = config?.bookingTypeKind;
  if (raw === "MEETING" || raw === "SERVICE" || raw === "CLASS") return raw;
  return "SERVICE";
}

/**
 * Editor layout defaults — archetype controls default visibility only.
 * All general-purpose capabilities remain available in Advanced settings.
 */
export type BookingTypeKindEditorDefaults = {
  /** Whether the Advanced settings panel starts expanded in the editor. */
  advancedExpandedByDefault: boolean;
  /** Suggested form defaults when creating a new type of this kind. */
  suggestPayment: boolean;
  suggestRecurring: boolean;
  suggestGroupCapacity: boolean;
  /** Copy hints for the primary (non-advanced) editor sections. */
  primaryFocus: string;
};

export function editorDefaultsForBookingTypeKind(kind: BookingTypeKind): BookingTypeKindEditorDefaults {
  switch (kind) {
    case "MEETING":
      return {
        advancedExpandedByDefault: false,
        suggestPayment: false,
        suggestRecurring: false,
        suggestGroupCapacity: false,
        primaryFocus: "name, duration, location, availability, host/team",
      };
    case "SERVICE":
      return {
        advancedExpandedByDefault: true,
        suggestPayment: true,
        suggestRecurring: true,
        suggestGroupCapacity: false,
        primaryFocus: "name, duration, location, price, availability",
      };
    case "CLASS":
      return {
        advancedExpandedByDefault: true,
        suggestPayment: true,
        suggestRecurring: true,
        suggestGroupCapacity: true,
        primaryFocus: "name, duration, provider, capacity, schedule, location",
      };
  }
}

/** @deprecated Use editorDefaultsForBookingTypeKind — all capabilities stay available in Advanced. */
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

/** @deprecated All features are available; defaults only affect initial expansion. */
export function featuresForBookingTypeKind(kind: BookingTypeKind): BookingTypeKindFeatures {
  const d = editorDefaultsForBookingTypeKind(kind);
  return {
    showPayment: true,
    showRecurring: true,
    showGroupCapacity: true,
    showResources: true,
    showAddOns: true,
    showServicePhases: true,
    showPackageEligibility: true,
    showClassEnrollment: kind === "CLASS" || d.suggestGroupCapacity,
  };
}

/** Sensible defaults when switching kind during create — does not remove capabilities. */
export function defaultConfigPatchForKind(kind: BookingTypeKind): Partial<AppointmentTypeConfig> {
  const base: Partial<AppointmentTypeConfig> = { bookingTypeKind: kind };
  if (kind === "CLASS") {
    return {
      ...base,
      groupBooking: { enabled: true, capacity: 10 },
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
