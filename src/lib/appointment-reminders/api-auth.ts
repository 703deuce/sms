import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";
import {
  requireAppointmentRemindersPermission,
  type AppointmentRemindersPermission,
} from "@/lib/appointment-reminders/permissions";

export type AppointmentRemindersAuth = {
  workspaceId: string;
  session: { userId: string; email?: string; isAdmin?: boolean };
};

export async function requireAppointmentRemindersAccess(
  permission: AppointmentRemindersPermission,
  options?: { bootstrap?: boolean },
): Promise<{ error: NextResponse } | AppointmentRemindersAuth> {
  const auth = await requireSession();
  if ("error" in auth) return auth;

  if (!options?.bootstrap) {
    const entitled = await workspaceHasAppointmentReminders(auth.workspaceId, {
      isPlatformAdmin: auth.session.isAdmin,
    });
    if (!entitled) {
      return {
        error: NextResponse.json(
          { error: "Appointment Reminders is not enabled for this workspace." },
          { status: 403 },
        ),
      };
    }

    try {
      await requireAppointmentRemindersPermission(
        auth.workspaceId,
        auth.session.userId,
        permission,
        auth.session.email,
      );
    } catch {
      return {
        error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
      };
    }
  }

  return {
    workspaceId: auth.workspaceId,
    session: auth.session,
  };
}
