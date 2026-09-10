import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, upsertAppointmentType } from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  getOrganizationPolicy,
  isManagedEventType,
  assertEventTypeAccess,
} from "@/lib/appointments/org-permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const rows = await listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true });
    const data = rows.find((row: { id: string }) => row.id === id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.types.manage");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      durationMinutes?: number;
      bufferMinutes?: number;
      calendarId?: string | null;
      config?: AppointmentTypeConfig;
    };
    if (body.config) {
      await assertEventTypeAccess(auth.workspaceId, auth.session.userId, auth.session.email, body.config, "edit");
    }
    const orgPolicy = await getOrganizationPolicy(auth.workspaceId);
    if (body.config && !isManagedEventType(body.config, orgPolicy)) {
      return NextResponse.json(
        { error: "Organization policy requires managed event types only" },
        { status: 403 },
      );
    }
    const data = await upsertAppointmentType(auth.workspaceId, {
      id,
      name: body.name || "Appointment",
      durationMinutes: body.durationMinutes,
      bufferMinutes: body.bufferMinutes,
      calendarId: body.calendarId,
      config: body.config,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
