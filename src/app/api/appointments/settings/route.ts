import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { getPrisma } from "@/lib/db";
import {
  loadAppointmentPlatformConfig,
  publicBookingUrl,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";

export async function GET() {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const [data, workspace] = await Promise.all([
      loadAppointmentPlatformConfig(auth.workspaceId),
      getPrisma().workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { slug: true, name: true, displayName: true, logoUrl: true },
      }),
    ]);
    return NextResponse.json({
      data,
      workspace: workspace
        ? {
            slug: workspace.slug,
            name: workspace.displayName || workspace.name,
            logoUrl: workspace.logoUrl,
            bookingUrl: workspace.slug ? publicBookingUrl(workspace.slug) : null,
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<AppointmentPlatformConfig>;
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
