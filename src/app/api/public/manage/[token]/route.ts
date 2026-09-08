import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  resolveManageAppointmentByToken,
  manageAppointmentReschedule,
  manageAppointmentCancel,
} from "@/lib/appointments/service-booking";
import { buildPublicAppointmentCustomerPreview } from "@/lib/appointments";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(resolved.appointment),
        permissions: resolved.token.permissions,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

    const body = await request.json();
    const { workspaceId } = resolved.token;
    const appointmentId = resolved.appointment.id;

    if (body.action === "cancel") {
      const updated = await manageAppointmentCancel(workspaceId, appointmentId, body.cancellationPolicy);
      return NextResponse.json({ data: buildPublicAppointmentCustomerPreview(updated) });
    }
    if (body.action === "reschedule" && body.startsAt) {
      const result = await manageAppointmentReschedule(
        workspaceId,
        appointmentId,
        body.startsAt,
        body.reschedulePolicy,
      );
      return NextResponse.json({
        data: buildPublicAppointmentCustomerPreview(result.appointment),
        afterCutoff: result.afterCutoff,
      });
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
