import type { BookingTypeKind } from "@/lib/appointments/booking-type-kind";

/** Customer-facing bookable object routes (admin). */
export const BOOKABLE_OBJECT_ADMIN_ROUTES = {
  meetings: "/appointments/meetings",
  services: "/appointments/services",
  classes: "/appointments/classes",
  workshops: "/appointments/workshops",
} as const;

export type BookableObjectSlug = keyof typeof BOOKABLE_OBJECT_ADMIN_ROUTES;

export type VoiceServiceBookableConfig = {
  slug: BookableObjectSlug;
  lockedKind: BookingTypeKind;
  pageTitle: string;
  pageDescription: string;
  createButtonLabel: string;
  listPanelTitle: string;
  listEmptyMessage: string;
  editorBackLabel: string;
};

export const VOICE_SERVICE_BOOKABLE_CONFIG: Record<
  "meetings" | "services",
  VoiceServiceBookableConfig
> = {
  meetings: {
    slug: "meetings",
    lockedKind: "MEETING",
    pageTitle: "Meetings",
    pageDescription: "Create meeting options customers can schedule with you or your team.",
    createButtonLabel: "Create meeting",
    listPanelTitle: "All meetings",
    listEmptyMessage: "No meetings yet. Create one to let customers schedule calls or meetings with you.",
    editorBackLabel: "Back to meetings",
  },
  services: {
    slug: "services",
    lockedKind: "SERVICE",
    pageTitle: "Services",
    pageDescription: "Create the services customers can book with your business.",
    createButtonLabel: "Create service",
    listPanelTitle: "All services",
    listEmptyMessage: "No services yet. Add the services customers can book with your business.",
    editorBackLabel: "Back to services",
  },
};

/** Legacy hub — redirect only; not a normal customer destination. */
export const LEGACY_BOOKING_TYPES_HUB = "/appointments/types";

export function canonicalAdminRouteForBookingTypeKind(kind: BookingTypeKind): string {
  switch (kind) {
    case "MEETING":
      return BOOKABLE_OBJECT_ADMIN_ROUTES.meetings;
    case "SERVICE":
      return BOOKABLE_OBJECT_ADMIN_ROUTES.services;
    case "CLASS":
      return BOOKABLE_OBJECT_ADMIN_ROUTES.classes;
    default:
      return BOOKABLE_OBJECT_ADMIN_ROUTES.services;
  }
}
