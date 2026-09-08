import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listAppointmentTypes,
  upsertAppointmentType,
} from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { BOOKING_TYPE_KINDS, type BookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  getOrganizationPolicy,
  isManagedEventType,
  filterEventTypesForUser,
  assertEventTypeAccess,
} from "@/lib/appointments/org-permissions";

export async function GET() {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const data = await listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true });
    const filtered = await filterEventTypesForUser(
      auth.workspaceId,
      auth.session.userId,
      auth.session.email,
      data,
      "view",
    );
    return NextResponse.json({ data: filtered });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.types.manage");
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
    if (
      body.config?.bookingTypeKind &&
      !BOOKING_TYPE_KINDS.includes(body.config.bookingTypeKind as BookingTypeKind)
    ) {
      return NextResponse.json({ error: "invalid bookingTypeKind" }, { status: 400 });
    }
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
