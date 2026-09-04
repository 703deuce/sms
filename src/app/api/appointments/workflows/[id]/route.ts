import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteAppointmentWorkflow,
  duplicateAppointmentWorkflow,
  getAppointmentWorkflow,
  updateAppointmentWorkflow,
} from "@/lib/appointment-workflows/service";
import type { UpdateAppointmentWorkflowInput } from "@/lib/appointment-workflows/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getAppointmentWorkflow(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as UpdateAppointmentWorkflowInput & { action?: string };

    if (body.action === "duplicate") {
      const data = await duplicateAppointmentWorkflow(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    const data = await updateAppointmentWorkflow(auth.workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deleteAppointmentWorkflow(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
