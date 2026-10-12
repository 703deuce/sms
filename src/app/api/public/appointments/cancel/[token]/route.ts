import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  cancelPlatformAppointment,
  findAppointmentByPublicToken,
} from "@/lib/appointments";
import { requestCancellationViaPublicEmail } from "@/lib/appointment-reminders/public-customer-actions";
import { resolvePublicAppointmentChangeWorkflow } from "@/lib/appointment-reminders/public-self-service-workflow";
import { triggerArCalendarWriteBack } from "@/lib/appointment-reminders/calendar-write-back/trigger";
import { commitPublicSelfServiceCancel } from "@/lib/appointment-reminders/public-self-service-cancel";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import {
  assertPublicSelfServiceAllowed,
  publicSelfServiceFieldsForAppointment,
} from "@/lib/appointment-reminders/public-self-service-api";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { cancelToken?: string })?.cancelToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const allowed = assertPublicSelfServiceAllowed(row);
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.message }, { status: 409 });
    }
    const workflow = await resolvePublicAppointmentChangeWorkflow(row.workspaceId);
    if (workflow === "request_only") {
      const result = await requestCancellationViaPublicEmail({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      await triggerArCalendarWriteBack({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        kind: "cancellation_requested",
      }).catch(() => undefined);
      return NextResponse.json({
        data: { id: row.id, status: result.status, requestRecorded: true },
      });
    }
    const ref = providerRefFromAppointment(row);
    if (ref) {
      const committed = await commitPublicSelfServiceCancel({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
      });
      if (!committed.ok) {
        return NextResponse.json({ error: committed.message }, { status: 400 });
      }
      await triggerArCalendarWriteBack({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        kind: "canceled",
      }).catch(() => undefined);
      const fresh = await findAppointmentByPublicToken(token);
      return NextResponse.json({
        data: { id: row.id, status: fresh?.status || "canceled" },
      });
    }
    const updated = await cancelPlatformAppointment(row.workspaceId, row.id, "customer");
    await triggerArCalendarWriteBack({
      workspaceId: row.workspaceId,
      appointmentId: row.id,
      kind: "canceled",
    }).catch(() => undefined);
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
    const workflow = await resolvePublicAppointmentChangeWorkflow(row.workspaceId);
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        requestOnly: workflow === "request_only",
        ...publicSelfServiceFieldsForAppointment(row),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
