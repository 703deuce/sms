import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  findAppointmentByPublicToken,
  reschedulePlatformAppointment,
} from "@/lib/appointments";
import {
  requestRescheduleViaPublicEmail,
} from "@/lib/appointment-reminders/public-customer-actions";
import { resolvePublicAppointmentChangeWorkflow } from "@/lib/appointment-reminders/public-self-service-workflow";
import { listPublicSelfServiceRescheduleSlots } from "@/lib/appointment-reminders/public-self-service-slots";
import { commitPublicSelfServiceReschedule } from "@/lib/appointment-reminders/public-self-service-commit";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { rescheduleToken?: string })?.rescheduleToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const workflow = await resolvePublicAppointmentChangeWorkflow(row.workspaceId);
    if (workflow === "request_only") {
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(row),
          endsAt: row.endsAt,
          slots: [],
          requestOnly: true,
        },
      });
    }

    const slotsResult = await listPublicSelfServiceRescheduleSlots({
      workspaceId: row.workspaceId,
      appointmentId: row.id,
    });
    if (!slotsResult.ok) {
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(row),
          endsAt: row.endsAt,
          slots: [],
          requestOnly: false,
          durationUnavailable: slotsResult.reason === "duration_unknown",
        },
      });
    }

    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        endsAt: row.endsAt,
        slots: slotsResult.slots,
        requestOnly: false,
        durationMinutes: slotsResult.durationMinutes,
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
    const workflow = await resolvePublicAppointmentChangeWorkflow(row.workspaceId);
    if (workflow === "request_only") {
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

    const ref = providerRefFromAppointment(row);
    if (ref) {
      const committed = await commitPublicSelfServiceReschedule({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        startsAt: body.startsAt,
      });
      if (!committed.ok) {
        return NextResponse.json({ error: committed.message }, { status: 400 });
      }
      const fresh = await findAppointmentByPublicToken(token);
      if (!fresh) {
        return NextResponse.json({ error: "Invalid token" }, { status: 404 });
      }
      return NextResponse.json({
        data: buildPublicAppointmentCustomerPreview(fresh),
      });
    }

    const updated = await reschedulePlatformAppointment(row.workspaceId, row.id, body.startsAt, "customer");
    return NextResponse.json({
      data: buildPublicAppointmentCustomerPreview(updated),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
