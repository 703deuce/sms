import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import type { AppointmentPermission } from "@/lib/appointments/org-permissions";

export async function withAppointmentsAuth<T>(
  permission: AppointmentPermission,
  handler: (ctx: { workspaceId: string; userId: string }) => Promise<T>,
) {
  try {
    const auth = await requireAppointmentsAccess(permission);
    if ("error" in auth) return auth.error;
    const result = await handler({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
