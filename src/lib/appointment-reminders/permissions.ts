import "server-only";

import type { GranularRole } from "@/lib/appointments/scheduling-capabilities";
import {
  assertAppointmentPermission,
  DEFAULT_ROLES,
  listGranularRoles,
  resolveUserRoleId,
} from "@/lib/appointments/org-permissions";
import type { AppointmentRemindersPermission } from "@/lib/appointment-reminders/permissions-types";
import { defaultArPermissionsForRole } from "@/lib/appointment-reminders/permissions-roles";

export type { AppointmentRemindersPermission } from "@/lib/appointment-reminders/permissions-types";
export { defaultArPermissionsForRole } from "@/lib/appointment-reminders/permissions-roles";

/** Appointments permissions that imply the matching AR permission (shared runtime, no full Appointments UI required). */
const APPOINTMENTS_IMPLIES: Record<
  AppointmentRemindersPermission,
  GranularRole["permissions"][number]
> = {
  "appointment_reminders.read": "appointments.read",
  "appointment_reminders.write": "appointments.write",
  "appointment_reminders.settings": "appointments.settings.manage",
  "appointment_reminders.calendar": "calendar.connect",
  "appointment_reminders.test": "appointments.settings.manage",
};

export async function assertAppointmentRemindersPermission(
  workspaceId: string,
  userId: string,
  permission: AppointmentRemindersPermission,
  email?: string,
): Promise<boolean> {
  const implied = APPOINTMENTS_IMPLIES[permission];
  if (await assertAppointmentPermission(workspaceId, userId, implied, email)) {
    return true;
  }

  const roleId = await resolveUserRoleId(workspaceId, userId, email);
  const roles = await listGranularRoles(workspaceId);
  const role = roles.find((r) => r.id === roleId) || DEFAULT_ROLES[0];
  const explicit = (role.permissions as string[]).includes(permission);
  if (explicit) return true;

  return defaultArPermissionsForRole(roleId).includes(permission);
}

export async function requireAppointmentRemindersPermission(
  workspaceId: string,
  userId: string,
  permission: AppointmentRemindersPermission,
  email?: string,
): Promise<void> {
  const ok = await assertAppointmentRemindersPermission(workspaceId, userId, permission, email);
  if (!ok) throw new Error("Insufficient permissions");
}
