import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import { buildLocationDetail } from "@/lib/appointments/locations/locations-workspace";
import { newLocation } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { AppointmentLocation } from "@/lib/appointments/types";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<AppointmentLocation>;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const loc: AppointmentLocation = {
      ...newLocation(),
      ...body,
      id: body.id || newLocation().id,
      name: body.name?.trim() || "New location",
      active: body.active !== false,
    };
    const locations = [...(platform.locations || []), loc];
    await saveAppointmentPlatformConfig(auth.workspaceId, { locations });
    const data = await buildLocationDetail(auth.workspaceId, loc.id);
    return NextResponse.json({ data, locationId: loc.id }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
