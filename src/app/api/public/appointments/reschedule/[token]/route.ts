import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  findAppointmentByPublicToken,
  getAvailability,
  loadAppointmentPlatformConfig,
  reschedulePlatformAppointment,
} from "@/lib/appointments";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { rescheduleToken?: string })?.rescheduleToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const config = await loadAppointmentPlatformConfig(row.workspaceId);
    const availability = await getAvailability(row.workspaceId, {
      serviceName: row.serviceName || undefined,
      daysAhead: 14,
    });
    const now = Date.now();
    const slots = availability.slots.filter(
      (slot) => new Date(slot.startsAt).getTime() > now + 60_000,
    );
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        endsAt: row.endsAt,
        slots,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { rescheduleToken?: string })?.rescheduleToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const body = (await request.json()) as { startsAt?: string };
    if (!body.startsAt) {
      return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
    }
    const updated = await reschedulePlatformAppointment(row.workspaceId, row.id, body.startsAt);
    return NextResponse.json({
      data: buildPublicAppointmentCustomerPreview(updated),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
