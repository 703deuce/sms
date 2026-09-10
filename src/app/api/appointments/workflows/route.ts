import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  createAppointmentWorkflow,
  installWorkflowFromTemplate,
  listAppointmentWorkflows,
} from "@/lib/appointment-workflows/service";
import type { CreateAppointmentWorkflowInput } from "@/lib/appointment-workflows/service";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";

export async function GET() {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
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
    const auth = await requireAppointmentsAccess("appointments.workflows.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as CreateAppointmentWorkflowInput & {
      action?: string;
      templateId?: string;
    };

    if (body.action === "install-template" && body.templateId) {
      const data = await installWorkflowFromTemplate(auth.workspaceId, body.templateId, body);
      return NextResponse.json({ data }, { status: 201 });
    }

    const data = await createAppointmentWorkflow(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
