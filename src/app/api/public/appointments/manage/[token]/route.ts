import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  findAppointmentByPublicToken,
} from "@/lib/appointments";
import { publicActionUrl } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { getPrisma } from "@/lib/db";
import { resolvePublicAppointmentChangeWorkflow } from "@/lib/appointment-reminders/public-self-service-workflow";
import { publicSelfServiceFieldsForAppointment } from "@/lib/appointment-reminders/public-self-service-api";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    const meta = (row?.metadata || {}) as AppointmentMetadata;
    if (!row || meta.manageToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const workspace = await getPrisma().workspace.findUnique({
      where: { id: row.workspaceId },
      select: { displayName: true, name: true },
    });
    const workflow = await resolvePublicAppointmentChangeWorkflow(row.workspaceId);

    const selfService = publicSelfServiceFieldsForAppointment(row);
    const blocked = selfService.selfServiceBlocked;
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        businessName: workspace?.displayName || workspace?.name || "Your appointment",
        endsAt: row.endsAt.toISOString(),
        requestOnly: workflow === "request_only",
        ...selfService,
        actions: blocked
          ? { reschedule: null, cancel: null }
          : {
              reschedule: meta.rescheduleToken
                ? publicActionUrl("reschedule", meta.rescheduleToken)
                : null,
              cancel: meta.cancelToken ? publicActionUrl("cancel", meta.cancelToken) : null,
            },
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
