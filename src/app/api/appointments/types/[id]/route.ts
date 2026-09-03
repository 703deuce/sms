import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { upsertAppointmentType } from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      durationMinutes?: number;
      bufferMinutes?: number;
      calendarId?: string | null;
      config?: AppointmentTypeConfig;
    };
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
