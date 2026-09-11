import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { syncStaffLocationAssignments } from "@/lib/appointments/staff/staff-service-sync";
import type { AppointmentLocation, BookableStaffMember } from "@/lib/appointments/types";

/** Keep Service `locationIds` aligned when Location ↔ Service eligibility changes from the Locations page. */
export async function syncLocationServiceAssignments(
  workspaceId: string,
  locationId: string,
  appointmentTypeIds: string[],
) {
  const prisma = getPrisma();
  const types = await prisma.voiceService.findMany({
    where: { workspaceId },
    select: { id: true, config: true },
  });
  const wanted = new Set(appointmentTypeIds);
  for (const row of types) {
    const cfg = (row.config || {}) as AppointmentTypeConfig;
    const locIds = [...(cfg.locationIds || [])];
    const has = locIds.includes(locationId);
    const shouldHave = wanted.has(row.id) || (wanted.size === 0 && false);
    // Empty appointmentTypeIds on location means "all types" — do not strip service locationIds.
    if (wanted.size === 0) continue;
    if (!shouldHave && has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, locationIds: locIds.filter((id) => id !== locationId) } as object },
      });
    } else if (shouldHave && !has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, locationIds: [...locIds, locationId] } as object },
      });
    }
  }
}

export function syncLocationStaffAssignments(
  locations: AppointmentLocation[],
  staff: BookableStaffMember[],
  locationId: string,
  staffIds: string[],
): { locations: AppointmentLocation[]; staff: BookableStaffMember[] } {
  let nextLocations = locations.map((loc) =>
    loc.id === locationId ? { ...loc, staffIds: [...staffIds] } : loc,
  );
  let nextStaff = staff;
  for (const member of staff) {
    const should = staffIds.includes(member.id);
    const has = (member.locationIds || []).includes(locationId);
    if (should === has) continue;
    const nextIds = should
      ? [...(member.locationIds || []), locationId]
      : (member.locationIds || []).filter((id) => id !== locationId);
    nextStaff = nextStaff.map((s) => (s.id === member.id ? { ...s, locationIds: nextIds } : s));
    nextLocations = syncStaffLocationAssignments(nextLocations, member.id, nextIds) as AppointmentLocation[];
  }
  return { locations: nextLocations, staff: nextStaff };
}
