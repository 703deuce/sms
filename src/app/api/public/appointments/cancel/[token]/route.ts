import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  cancelPlatformAppointment,
  findAppointmentByPublicToken,
} from "@/lib/appointments";
import {
  publicEmailActionsUseStaffRequestWorkflow,
  requestCancellationViaPublicEmail,
} from "@/lib/appointment-reminders/public-customer-actions";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { cancelToken?: string })?.cancelToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const requestOnly = await publicEmailActionsUseStaffRequestWorkflow(row.workspaceId);
    if (requestOnly) {
      const result = await requestCancellationViaPublicEmail({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({
        data: { id: row.id, status: result.status, requestRecorded: true },
      });
    }
    const updated = await cancelPlatformAppointment(row.workspaceId, row.id);
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { cancelToken?: string })?.cancelToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const requestOnly = await publicEmailActionsUseStaffRequestWorkflow(row.workspaceId);
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        requestOnly,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
