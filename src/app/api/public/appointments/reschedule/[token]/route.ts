import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  findAppointmentByPublicToken,
  getAvailability,
  reschedulePlatformAppointment,
} from "@/lib/appointments";
import {
  publicEmailActionsUseStaffRequestWorkflow,
  requestRescheduleViaPublicEmail,
} from "@/lib/appointment-reminders/public-customer-actions";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { rescheduleToken?: string })?.rescheduleToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const requestOnly = await publicEmailActionsUseStaffRequestWorkflow(row.workspaceId);
    if (requestOnly) {
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(row),
          endsAt: row.endsAt,
          slots: [],
          requestOnly: true,
        },
      });
    }
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
        requestOnly: false,
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
    const body = (await request.json()) as {
      startsAt?: string;
      preferredStartsAt?: string;
      note?: string;
    };
    const requestOnly = await publicEmailActionsUseStaffRequestWorkflow(row.workspaceId);
    if (requestOnly) {
      const result = await requestRescheduleViaPublicEmail({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        note: body.note,
        preferredStartsAt: body.preferredStartsAt || body.startsAt,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      const fresh = await findAppointmentByPublicToken(token);
      if (!fresh) {
        return NextResponse.json({ error: "Invalid token" }, { status: 404 });
      }
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(fresh),
          requestRecorded: true,
          status: result.status,
        },
      });
    }
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
