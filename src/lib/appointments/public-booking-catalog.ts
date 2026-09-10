import type { BookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import type { BookingTerminologyConfig } from "@/lib/appointments/service-booking/types";
import type { SchedulerThemeConfig } from "@/lib/appointments/service-booking/types";

export type PublicCatalogTerminology = {
  meetingLabel: string;
  serviceLabel: string;
  classLabel: string;
  workshopLabel: string;
  bookButtonLabel: string;
  scheduleButtonLabel: string;
  registerButtonLabel: string;
  joinClassButtonLabel: string;
  appointmentLabel: string;
  staffLabel: string;
};

export type PublicCatalogGroup = "meetings" | "services" | "classes" | "workshops";

export type PublicCatalogTypeRef = {
  id: string;
  name: string;
  durationMinutes: number;
  bookingTypeKind: BookingTypeKind;
  group: "meetings" | "services" | "workshops";
  isWorkshop: boolean;
  config?: AppointmentTypeConfig | null;
};

export type PublicBookingCatalog = {
  meetings: PublicCatalogTypeRef[];
  services: PublicCatalogTypeRef[];
  workshops: PublicCatalogTypeRef[];
  hasClasses: boolean;
  classesUrl: string;
  isEmpty: boolean;
};

export function resolvePublicTerminology(
  terminology?: BookingTerminologyConfig | null,
): PublicCatalogTerminology {
  const serviceLabel = terminology?.serviceLabel?.trim() || "Services";
  const appointmentLabel = terminology?.appointmentLabel?.trim() || "appointment";
  return {
    meetingLabel: "Meetings",
    serviceLabel,
    classLabel: "Classes",
    workshopLabel: "Workshops & Events",
    bookButtonLabel: terminology?.bookButtonLabel?.trim() || "Book",
    scheduleButtonLabel: "Schedule",
    registerButtonLabel: "Register",
    joinClassButtonLabel: "Join class",
    appointmentLabel,
    staffLabel: terminology?.staffLabel?.trim() || "Staff",
  };
}

/** @alias resolvePublicTerminology */
export const resolvePublicBookingTerminology = resolvePublicTerminology;

export function resolvePublicTerminologyFromTheme(
  theme?: SchedulerThemeConfig | null,
): PublicCatalogTerminology {
  return resolvePublicTerminology(theme?.terminology);
}

export function publicCatalogGroup(
  config?: AppointmentTypeConfig | null,
): "meetings" | "services" | "workshops" {
  if (isWorkshopEventType(config)) return "workshops";
  const kind = resolveBookingTypeKind(config);
  if (kind === "MEETING") return "meetings";
  return "services";
}

export function isWorkshopEventType(config?: AppointmentTypeConfig | null): boolean {
  if (!config) return false;
  return Boolean(
    config.groupBooking?.enabled &&
      (config as { workshopEvent?: boolean }).workshopEvent === true,
  );
}

function isPublicVisibility(config?: AppointmentTypeConfig | null): boolean {
  const vis = config?.visibility || "public";
  return vis === "public";
}

function isDirectLinkVisibility(config?: AppointmentTypeConfig | null): boolean {
  const vis = config?.visibility || "public";
  return vis === "public" || vis === "unlisted" || vis === "secret";
}

export function filterPublicSchedulerTypes<
  T extends {
    id: string;
    config?: AppointmentTypeConfig | null;
    bookingTypeKind?: BookingTypeKind;
  },
>(types: T[], opts?: { includeTypeId?: string }): T[] {
  return types.filter((t) => {
    const kind = t.bookingTypeKind || resolveBookingTypeKind(t.config);
    if (kind === "CLASS") return false;
    if (isWorkshopEventType(t.config)) return false;
    if (opts?.includeTypeId && t.id === opts.includeTypeId) {
      return isDirectLinkVisibility(t.config);
    }
    return isPublicVisibility(t.config);
  });
}

export function buildPublicBookingCatalog<
  T extends {
    id: string;
    name: string;
    durationMinutes: number;
    config?: AppointmentTypeConfig | null;
    bookingTypeKind?: BookingTypeKind;
  },
>(types: T[], workspaceSlug: string): PublicBookingCatalog {
  const publicTypes = types.filter((t) => {
    const kind = t.bookingTypeKind || resolveBookingTypeKind(t.config);
    if (kind === "CLASS") return false;
    return isPublicVisibility(t.config);
  });

  const meetings: PublicCatalogTypeRef[] = [];
  const services: PublicCatalogTypeRef[] = [];
  const workshops: PublicCatalogTypeRef[] = [];

  for (const t of publicTypes) {
    const kind = t.bookingTypeKind || resolveBookingTypeKind(t.config);
    const workshop = isWorkshopEventType(t.config);
    const group = publicCatalogGroup(t.config);
    const ref: PublicCatalogTypeRef = {
      id: t.id,
      name: t.name,
      durationMinutes: t.durationMinutes,
      bookingTypeKind: kind,
      group,
      isWorkshop: workshop,
      config: t.config,
    };
    if (group === "meetings") meetings.push(ref);
    else if (group === "workshops") workshops.push(ref);
    else services.push(ref);
  }

  const hasClasses = types.some(
    (t) =>
      isPublicVisibility(t.config) &&
      (t.bookingTypeKind || resolveBookingTypeKind(t.config)) === "CLASS",
  );

  return {
    meetings,
    services,
    workshops,
    hasClasses,
    classesUrl: `/book/${workspaceSlug}/classes`,
    isEmpty: meetings.length === 0 && services.length === 0 && workshops.length === 0 && !hasClasses,
  };
}

export function actionLabelForType(
  config?: AppointmentTypeConfig | null,
  terminology?: PublicCatalogTerminology,
): string {
  const t = terminology || resolvePublicTerminology();
  const kind = resolveBookingTypeKind(config);
  if (kind === "MEETING") return t.scheduleButtonLabel;
  if (isWorkshopEventType(config)) return t.registerButtonLabel;
  return t.bookButtonLabel;
}
