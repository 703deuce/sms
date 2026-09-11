import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import { buildStaffDetail } from "@/lib/appointments/staff/staff-workspace";
import {
  syncStaffLocationAssignments,
  syncStaffServiceAssignments,
  upsertStaffMember,
} from "@/lib/appointments/staff/staff-service-sync";
import type { AppointmentLocation, BookableStaffMember } from "@/lib/appointments/types";
import { newStaffMember } from "@/features/appointments/kimi/shared/platform-settings-types"; // staff shape helper

type Params = { params: Promise<{ staffId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { staffId } = await params;
    const data = await buildStaffDetail(auth.workspaceId, staffId);
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
    const { staffId } = await params;
    const body = (await request.json()) as {
      member?: Partial<BookableStaffMember>;
      appointmentTypeIds?: string[];
      locationIds?: string[];
      deactivate?: boolean;
      forceDeactivate?: boolean;
    };

    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const existing = (platform.staff || []).find((s) => s.id === staffId);
    if (!existing && staffId !== "new") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let member: BookableStaffMember =
      existing ||
      ({
        ...newStaffMember(),
        id: staffId.startsWith("staff_") ? staffId : `staff_${Date.now()}`,
        createdAt: new Date().toISOString(),
      } as BookableStaffMember);

    if (body.member) {
      member = { ...member, ...body.member, id: member.id };
    }
    if (body.appointmentTypeIds) {
      member = { ...member, appointmentTypeIds: body.appointmentTypeIds };
    }
    if (body.locationIds) {
      member = { ...member, locationIds: body.locationIds };
    }
    if (body.deactivate) {
      const detail = await buildStaffDetail(auth.workspaceId, member.id);
      if (detail && detail.futureAppointmentCount > 0 && !body.forceDeactivate) {
        return NextResponse.json(
          {
            error: `${member.name} has ${detail.futureAppointmentCount} future appointments.`,
            code: "future_appointments",
            futureAppointmentCount: detail.futureAppointmentCount,
          },
          { status: 409 },
        );
      }
      member = { ...member, active: false };
    }

    if (!member.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const nextStaff = upsertStaffMember(platform.staff || [], member);
    let nextLocations: AppointmentLocation[] = platform.locations || [];
    if (body.locationIds || body.member?.locationIds) {
      nextLocations = syncStaffLocationAssignments(nextLocations, member.id, member.locationIds || []) as AppointmentLocation[];
    }

    await saveAppointmentPlatformConfig(auth.workspaceId, {
      staff: nextStaff,
      locations: nextLocations,
    } as object);

    if (body.appointmentTypeIds || body.member?.appointmentTypeIds) {
      await syncStaffServiceAssignments(auth.workspaceId, member.id, member.appointmentTypeIds || []);
    }

    const data = await buildStaffDetail(auth.workspaceId, member.id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
