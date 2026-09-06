import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listAppointmentTypes,
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
  upsertAppointmentType,
} from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import {
  getOrganizationPolicy,
  isManagedEventType,
  requireAppointmentPermission,
} from "@/lib/appointments/org-permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listAppointmentTypes(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      durationMinutes?: number;
      bufferMinutes?: number;
      calendarId?: string | null;
      config?: AppointmentTypeConfig;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await requireAppointmentPermission(auth.workspaceId, auth.session.userId, "appointments.types.manage");
    const orgPolicy = await getOrganizationPolicy(auth.workspaceId);
    if (body.config && !isManagedEventType(body.config, orgPolicy)) {
      return NextResponse.json(
        { error: "Organization policy requires managed event types only" },
        { status: 403 },
      );
    }
    const data = await upsertAppointmentType(auth.workspaceId, {
      name: body.name,
      durationMinutes: body.durationMinutes,
      bufferMinutes: body.bufferMinutes,
      calendarId: body.calendarId,
      config: body.config,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
