import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createAppointmentWorkflow,
  listAppointmentWorkflows,
} from "@/lib/appointment-workflows/service";
import type { CreateAppointmentWorkflowInput } from "@/lib/appointment-workflows/service";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workflows = await listAppointmentWorkflows(auth.workspaceId);
    return NextResponse.json({
      data: {
        workflows,
        templates: PREBUILT_WORKFLOW_TEMPLATES,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as CreateAppointmentWorkflowInput;
    const data = await createAppointmentWorkflow(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
