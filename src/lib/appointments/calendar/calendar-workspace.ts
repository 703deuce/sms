import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { listSchedulingResources } from "@/lib/appointments/service-booking/resources";
import { getPrisma } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";

export async function buildCalendarWorkspace(workspaceId: string) {
  const [platform, resources, types] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    listSchedulingResources(workspaceId),
    listAppointmentTypes(workspaceId),
  ]);

  const staff = (platform.staff || [])
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.id, name: s.name }));

  const locations = (platform.locations || [])
    .filter((l) => l.active !== false)
    .map((l) => ({ id: l.id, name: l.name, kind: l.kind }));

  const services = types
    .filter((t) => t.config?.enabled !== false)
    .map((t) => ({ id: t.id, name: t.name }));

  return {
    staff,
    locations,
    resources: resources
      .filter((r) => r.active)
      .map((r) => ({ id: r.id, name: r.name, quantity: r.quantity })),
    services,
    timezone: platform.timezone,
  };
}

export type CalendarListFilters = {
  staffIds?: string[];
  locationId?: string;
  resourceId?: string;
  status?: string;
  domainType?: string;
  q?: string;
};
