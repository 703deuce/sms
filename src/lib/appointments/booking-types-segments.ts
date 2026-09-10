import type { BookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";

/** Customer-facing segment — not the same as bookingTypeKind enum labels in UI. */
export type BookingTypesSegmentId = "meetings" | "services" | "classes" | "workshops";

/**
 * CLASS-only presentation split: recurring class series vs one-off workshop/event.
 * Shared CLASS scheduling engine; separate management destinations in UI.
 */
export type ClassPresentation = "recurring_class" | "workshop_event";

export function resolveClassPresentation(config?: AppointmentTypeConfig | null): ClassPresentation {
  if (config?.classPresentation === "workshop_event") return "workshop_event";
  return "recurring_class";
}

export type BookingTypesSegment = {
  id: BookingTypesSegmentId;
  title: string;
  description: string;
  examples?: string;
  listHref: string;
  createHref: string;
  bookingTypeKind: BookingTypeKind;
  classPresentation?: ClassPresentation;
};

export const BOOKING_TYPES_SEGMENTS: BookingTypesSegment[] = [
  {
    id: "meetings",
    title: "Meetings",
    description:
      "Schedule calls, consultations, demos, interviews, and other one-on-one or team meetings.",
    examples: "Discovery call · Sales demo · Interview · Consultation",
    listHref: "/appointments/meetings",
    createHref: "/appointments/meetings/new",
    bookingTypeKind: "MEETING",
  },
  {
    id: "services",
    title: "Services",
    description:
      "Book provider-based appointments such as training, tutoring, salon services, massage, inspections, repairs, photography, and private sessions.",
    listHref: "/appointments/types/services",
    createHref: "/appointments/types/services/new",
    bookingTypeKind: "SERVICE",
  },
  {
    id: "classes",
    title: "Classes",
    description:
      "Let multiple customers enroll in the same scheduled class with capacity, attendance, and waitlist options.",
    listHref: "/appointments/types/classes",
    createHref: "/appointments/types/editor?segment=classes&create=1",
    bookingTypeKind: "CLASS",
    classPresentation: "recurring_class",
  },
  {
    id: "workshops",
    title: "Workshops & Events",
    description:
      "Take registrations for workshops, seminars, special events, and limited-run group sessions.",
    listHref: "/appointments/types/workshops",
    createHref: "/appointments/types/editor?segment=workshops&create=1",
    bookingTypeKind: "CLASS",
    classPresentation: "workshop_event",
  },
];

export function segmentById(id: BookingTypesSegmentId): BookingTypesSegment {
  const row = BOOKING_TYPES_SEGMENTS.find((s) => s.id === id);
  if (!row) throw new Error(`Unknown segment: ${id}`);
  return row;
}

export type ApiTypeRow = {
  id: string;
  name: string;
  durationMinutes?: number;
  config?: AppointmentTypeConfig | null;
  active?: boolean;
};

export function typeBelongsToSegment(
  row: ApiTypeRow,
  segmentId: BookingTypesSegmentId,
): boolean {
  const kind = resolveBookingTypeKind(row.config);
  const classPresentation = resolveClassPresentation(row.config);

  switch (segmentId) {
    case "meetings":
      return kind === "MEETING";
    case "services":
      return kind === "SERVICE";
    case "classes":
      return kind === "CLASS" && classPresentation === "recurring_class";
    case "workshops":
      return kind === "CLASS" && classPresentation === "workshop_event";
    default:
      return false;
  }
}

export function countActiveInSegment(rows: ApiTypeRow[], segmentId: BookingTypesSegmentId): number {
  return rows.filter((r) => {
    if (r.config?.enabled === false || r.active === false) return false;
    return typeBelongsToSegment(r, segmentId);
  }).length;
}

export function segmentStatusLabel(count: number, segmentId: BookingTypesSegmentId): string {
  if (count === 0) {
    switch (segmentId) {
      case "meetings":
        return "No meetings yet";
      case "services":
        return "No services yet";
      case "classes":
        return "No classes yet";
      case "workshops":
        return "No workshops yet";
    }
  }
  const noun =
    segmentId === "meetings"
      ? "meeting"
      : segmentId === "services"
        ? "service"
        : segmentId === "classes"
          ? "class"
          : "workshop or event";
  return `${count} active ${noun}${count === 1 ? "" : "s"}`;
}

export function defaultConfigForSegment(segment: BookingTypesSegment): Partial<AppointmentTypeConfig> {
  const base: Partial<AppointmentTypeConfig> = {
    bookingTypeKind: segment.bookingTypeKind,
  };
  if (segment.bookingTypeKind === "CLASS") {
    base.groupBooking = { enabled: true, capacity: segment.classPresentation === "workshop_event" ? 50 : 10 };
    base.recurring = { enabled: segment.classPresentation !== "workshop_event" };
    base.classPresentation = segment.classPresentation ?? "recurring_class";
  }
  if (segment.bookingTypeKind === "MEETING") {
    base.payment = { mode: "none" };
    base.recurring = { enabled: false };
    base.groupBooking = { enabled: false, capacity: 1 };
  }
  return base;
}
