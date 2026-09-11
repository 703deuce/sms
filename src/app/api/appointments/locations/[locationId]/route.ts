import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import { buildLocationDetail } from "@/lib/appointments/locations/locations-workspace";
import {
  syncLocationServiceAssignments,
  syncLocationStaffAssignments,
} from "@/lib/appointments/locations/location-service-sync";
import type { AppointmentLocation } from "@/lib/appointments/types";

type Params = { params: Promise<{ locationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { locationId } = await params;
    const data = await buildLocationDetail(auth.workspaceId, locationId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const { locationId } = await params;
    const body = (await request.json()) as {
      location?: Partial<AppointmentLocation>;
      appointmentTypeIds?: string[];
      staffIds?: string[];
      resourceIds?: string[];
      deactivate?: boolean;
      forceDeactivate?: boolean;
    };

    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const existing = (platform.locations || []).find((l) => l.id === locationId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let loc: AppointmentLocation = { ...existing, ...(body.location || {}) };

    if (body.appointmentTypeIds) {
      loc = { ...loc, appointmentTypeIds: body.appointmentTypeIds };
    }
    if (body.staffIds) {
      loc = { ...loc, staffIds: body.staffIds };
    }
    if (body.resourceIds) {
      loc = { ...loc, resourceIds: body.resourceIds };
    }
    if (body.deactivate) {
      const detail = await buildLocationDetail(auth.workspaceId, locationId);
      if (detail && detail.futureAppointmentCount > 0 && !body.forceDeactivate) {
        return NextResponse.json(
          {
            error: `${loc.name} has ${detail.futureAppointmentCount} future appointments.`,
            code: "future_appointments",
            futureAppointmentCount: detail.futureAppointmentCount,
          },
          { status: 409 },
        );
      }
      loc = { ...loc, active: false };
    }

    if (!loc.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let locations = (platform.locations || []).map((l) => (l.id === locationId ? loc : l));
    let staff = platform.staff || [];

    if (body.staffIds) {
      const synced = syncLocationStaffAssignments(locations, staff, locationId, body.staffIds);
      locations = synced.locations;
      staff = synced.staff;
    }

    await saveAppointmentPlatformConfig(auth.workspaceId, { locations, staff });

    if (body.appointmentTypeIds && body.appointmentTypeIds.length > 0) {
      await syncLocationServiceAssignments(auth.workspaceId, locationId, body.appointmentTypeIds);
    }

    const data = await buildLocationDetail(auth.workspaceId, locationId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
