import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { previewAppointmentWorkflow } from "@/lib/appointment-workflows/preview";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<AppointmentWorkflowRecord> & {
      appointmentId?: string;
    };

    if (!body.name || !body.trigger || !body.steps?.length) {
      return NextResponse.json(
        { error: "name, trigger, and at least one step are required" },
        { status: 400 },
      );
    }

    const preview = await previewAppointmentWorkflow({
      workspaceId: auth.workspaceId,
      workflow: {
        name: body.name,
        trigger: body.trigger,
        conditions: body.conditions ?? null,
        steps: body.steps,
        channels: body.channels || ["sms"],
      },
      appointmentId: body.appointmentId,
    });
    return NextResponse.json({ data: preview });
  } catch (err) {
    return jsonError(err, 400);
  }
}
