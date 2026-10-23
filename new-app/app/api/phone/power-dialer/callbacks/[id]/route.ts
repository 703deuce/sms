import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      action?: "complete" | "cancel" | "reschedule";
      scheduledAt?: string;
      assignedUserId?: string;
      notes?: string;
    };
    const prisma = getPrisma();
    const row = await prisma.powerDialerCallback.findFirst({ where: { id, workspaceId } });
    if (!row) throw new Error("Callback not found");

    if (body.action === "complete") {
      await prisma.powerDialerCallback.update({
        where: { id },
        data: { status: "completed", completedAt: new Date() },
      });
    } else if (body.action === "cancel") {
      await prisma.powerDialerCallback.update({
        where: { id },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
    } else if (body.action === "reschedule" && body.scheduledAt) {
      await prisma.powerDialerCallback.update({
        where: { id },
        data: {
          scheduledAt: new Date(body.scheduledAt),
          status: "scheduled",
          notes: body.notes ?? row.notes,
          assignedUserId: body.assignedUserId ?? row.assignedUserId,
        },
      });
    } else {
      await prisma.powerDialerCallback.update({
        where: { id },
        data: {
          notes: body.notes,
          assignedUserId: body.assignedUserId,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
