import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { newStaffMember } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { BookableStaffMember } from "@/lib/appointments/types";
import { syncStaffLocationAssignments, syncStaffServiceAssignments } from "@/lib/appointments/staff/staff-service-sync";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<BookableStaffMember> & { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const member: BookableStaffMember = {
      ...newStaffMember(),
      ...body,
      name: body.name.trim(),
      createdAt: new Date().toISOString(),
    };
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const nextStaff = [...(platform.staff || []), member];
    const nextLocations = syncStaffLocationAssignments(
      platform.locations || [],
      member.id,
      member.locationIds || [],
    );
    await saveAppointmentPlatformConfig(auth.workspaceId, { staff: nextStaff, locations: nextLocations } as object);
    if (member.appointmentTypeIds?.length) {
      await syncStaffServiceAssignments(auth.workspaceId, member.id, member.appointmentTypeIds);
    }
    return NextResponse.json({ data: member }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
