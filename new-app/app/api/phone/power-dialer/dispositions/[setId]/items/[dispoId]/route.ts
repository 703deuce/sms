import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ setId: string; dispoId: string }> },
) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { setId, dispoId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = getPrisma();
    const set = await prisma.powerDialerDispositionSet.findFirst({ where: { id: setId, workspaceId } });
    if (!set) throw new Error("Set not found");
    const data = await prisma.powerDialerDisposition.update({
      where: { id: dispoId, setId },
      data: {
        label: typeof body.label === "string" ? body.label : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        requireNotes: typeof body.requireNotes === "boolean" ? body.requireNotes : undefined,
        markConnected: typeof body.markConnected === "boolean" ? body.markConnected : undefined,
        markContactCompleted:
          typeof body.markContactCompleted === "boolean" ? body.markContactCompleted : undefined,
        scheduleCallback: typeof body.scheduleCallback === "boolean" ? body.scheduleCallback : undefined,
        removeFromQueue: typeof body.removeFromQueue === "boolean" ? body.removeFromQueue : undefined,
        addToDnc: typeof body.addToDnc === "boolean" ? body.addToDnc : undefined,
        triggerCrmUpdate: typeof body.triggerCrmUpdate === "boolean" ? body.triggerCrmUpdate : undefined,
        triggerFollowUp: typeof body.triggerFollowUp === "boolean" ? body.triggerFollowUp : undefined,
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ setId: string; dispoId: string }> },
) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { setId, dispoId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const set = await prisma.powerDialerDispositionSet.findFirst({ where: { id: setId, workspaceId } });
    if (!set) throw new Error("Set not found");
    const used = await prisma.powerDialerAttempt.count({ where: { dispositionId: dispoId } });
    if (used > 0) throw new Error("Disposition is in use on past attempts");
    await prisma.powerDialerDisposition.delete({ where: { id: dispoId, setId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
