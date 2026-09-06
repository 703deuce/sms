import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  requireAppointmentPermission,
  type AppointmentPermission,
} from "@/lib/appointments/org-permissions";

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
    return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }
  return auth;
}
