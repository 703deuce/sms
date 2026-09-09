import "server-only";

import type { AppointmentLocation } from "@/lib/appointments/types";
import type { WeeklyHours } from "@/lib/appointments/availability-engine-policy";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

export function findLocation(
  platform: AppointmentPlatformConfig,
  locationId?: string,
): AppointmentLocation | null {
  if (!locationId) return null;
  return (platform.locations || []).find((l) => l.id === locationId && l.active !== false) || null;
}

export function resolveLocationTimezone(
  platform: AppointmentPlatformConfig,
  locationId?: string,
): string {
  const loc = findLocation(platform, locationId);
  return loc?.timezone || platform.timezone || "America/New_York";
}

export function resolveLocationWeeklyHours(
  platform: AppointmentPlatformConfig,
  locationId?: string,
): WeeklyHours {
  const loc = findLocation(platform, locationId);
  if (loc?.weeklyHours && Object.keys(loc.weeklyHours).length) return loc.weeklyHours;
  return resolveWeeklyHours(platform);
}

export function filterStaffIdsForLocation(
  platform: AppointmentPlatformConfig,
  locationId: string | undefined,
  staffIds: string[],
): string[] {
  const loc = findLocation(platform, locationId);
  if (!loc?.staffIds?.length) return staffIds;
  const allowed = new Set(loc.staffIds);
  const filtered = staffIds.filter((id) => allowed.has(id));
  return filtered.length ? filtered : loc.staffIds;
}

export function locationOffersType(
  platform: AppointmentPlatformConfig,
  locationId: string | undefined,
  typeId: string,
): boolean {
  const loc = findLocation(platform, locationId);
  if (!loc?.appointmentTypeIds?.length) return true;
  return loc.appointmentTypeIds.includes(typeId);
}

export function listActiveLocations(platform: AppointmentPlatformConfig): AppointmentLocation[] {
  return (platform.locations || []).filter((l) => l.active !== false);
}

export function filterResourceIdsForLocation(
  platform: AppointmentPlatformConfig,
  locationId: string | undefined,
  resourceIds: string[],
): string[] {
  const loc = findLocation(platform, locationId);
  if (!loc?.resourceIds?.length) return resourceIds;
  const allowed = new Set(loc.resourceIds);
  const filtered = resourceIds.filter((id) => allowed.has(id));
  return filtered.length ? filtered : loc.resourceIds;
}
