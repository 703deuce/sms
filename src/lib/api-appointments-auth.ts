import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  requireAppointmentPermission,
  type AppointmentPermission,
} from "@/lib/appointments/org-permissions";
import { requireAppointmentRemindersPermission } from "@/lib/appointment-reminders/permissions";
import type { AppointmentRemindersPermission } from "@/lib/appointment-reminders/permissions-types";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";

const APPOINTMENTS_TO_AR: Partial<Record<AppointmentPermission, AppointmentRemindersPermission>> = {
  "appointments.read": "appointment_reminders.read",
  "appointments.write": "appointment_reminders.write",
  "appointments.book": "appointment_reminders.write",
  "appointments.types.manage": "appointment_reminders.settings",
  "appointments.settings.manage": "appointment_reminders.settings",
  "appointments.analytics.read": "appointment_reminders.read",
  "calendar.connect": "appointment_reminders.calendar",
};

/** Session + workspace + granular appointment permission check for API routes. */
export async function requireAppointmentsAccess(permission: AppointmentPermission) {
  const auth = await requireSession();
  if ("error" in auth) return auth;
  try {
    await requireAppointmentPermission(
      auth.workspaceId,
      auth.session.userId,
      permission,
      auth.session.email,
    );
  } catch {
    const arPermission = APPOINTMENTS_TO_AR[permission];
    if (arPermission) {
      const entitled = await workspaceHasAppointmentReminders(auth.workspaceId, {
        isPlatformAdmin: auth.session.isAdmin,
      });
      if (entitled) {
        try {
          await requireAppointmentRemindersPermission(
            auth.workspaceId,
            auth.session.userId,
            arPermission,
            auth.session.email,
          );
          return auth;
        } catch {
          // fall through to 403
        }
      }
    }
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return auth;
}
