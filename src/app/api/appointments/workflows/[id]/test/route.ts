import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getAppointmentWorkflow } from "@/lib/appointment-workflows/service";
import { previewAppointmentWorkflow } from "@/lib/appointment-workflows/preview";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { appointmentId?: string };
    const workflow = await getAppointmentWorkflow(auth.workspaceId, id);
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const preview = await previewAppointmentWorkflow({
      workspaceId: auth.workspaceId,
      workflow,
      appointmentId: body.appointmentId,
    });
    return NextResponse.json({ data: preview });
  } catch (err) {
    return jsonError(err, 400);
  }
}
