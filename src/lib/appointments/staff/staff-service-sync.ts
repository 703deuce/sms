import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";

const POOL_MODES = new Set([
  "specific_staff",
  "customer_chooses",
  "round_robin",
  "priority",
  "maximize_availability",
  "collective",
]);

/** Keep Service `staffIds` aligned when Staff ↔ Service eligibility changes from the Staff page. */
export async function syncStaffServiceAssignments(
  workspaceId: string,
  staffId: string,
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
    const mode = String(cfg.staffAssignment || "");
    const usesPool = POOL_MODES.has(mode) || (cfg.staffIds?.length ?? 0) > 0;
    const staffIds = [...(cfg.staffIds || [])];
    const has = staffIds.includes(staffId);
    const shouldHave = wanted.has(row.id);
    if (!shouldHave && !has) continue;
    if (!shouldHave && has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, staffIds: staffIds.filter((id) => id !== staffId) } as object },
      });
      continue;
    }
    if (shouldHave && usesPool && !has) {
      await prisma.voiceService.update({
        where: { id: row.id },
        data: { config: { ...cfg, staffIds: [...staffIds, staffId] } as object },
      });
    }
  }
}

export function syncStaffLocationAssignments(
  locations: Array<{ id: string; staffIds?: string[] }>,
  staffId: string,
  locationIds: string[],
): Array<{ id: string; staffIds?: string[] }> {
  const wanted = new Set(locationIds);
  return locations.map((loc) => {
    const ids = [...(loc.staffIds || [])];
    const has = ids.includes(staffId);
    const shouldHave = wanted.has(loc.id);
    if (shouldHave && !has) return { ...loc, staffIds: [...ids, staffId] };
    if (!shouldHave && has) return { ...loc, staffIds: ids.filter((id) => id !== staffId) };
    return loc;
  });
}

export function upsertStaffMember(
  staff: BookableStaffMember[],
  member: BookableStaffMember,
): BookableStaffMember[] {
  const idx = staff.findIndex((s) => s.id === member.id);
  if (idx >= 0) return staff.map((s, i) => (i === idx ? member : s));
  return [...staff, member];
}
