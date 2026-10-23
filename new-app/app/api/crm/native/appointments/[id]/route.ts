import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { deleteAppointment, patchAppointment } from "@/lib/server/crm/native/tasks-appointments";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    const data = await patchAppointment(workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const data = await deleteAppointment(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
