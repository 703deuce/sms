import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import {
  assertDispositionSetInUse,
  reorderDispositions,
  setDefaultDispositionSet,
} from "@/lib/server/phone/power-dialer/dispositions-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { setId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      name?: string;
      action?: "set_default" | "reorder";
      orderedDispositionIds?: string[];
    };
    if (body.action === "set_default") {
      const data = await setDefaultDispositionSet(workspaceId, setId);
      return NextResponse.json({ data });
    }
    if (body.action === "reorder" && body.orderedDispositionIds?.length) {
      const data = await reorderDispositions(workspaceId, setId, body.orderedDispositionIds);
      return NextResponse.json({ data });
    }
    if (body.name) {
      const prisma = getPrisma();
      const data = await prisma.powerDialerDispositionSet.update({
        where: { id: setId },
        data: { name: body.name },
        include: { dispositions: { orderBy: { sortOrder: "asc" } } },
      });
      return NextResponse.json({ data });
    }
    throw new Error("No valid patch");
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { setId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const set = await prisma.powerDialerDispositionSet.findFirst({ where: { id: setId, workspaceId } });
    if (!set) throw new Error("Set not found");
    if (set.isDefault) throw new Error("Cannot delete the default disposition set");
    if (await assertDispositionSetInUse(workspaceId, setId)) {
      throw new Error("Disposition set is assigned to a campaign");
    }
    await prisma.powerDialerDispositionSet.delete({ where: { id: setId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
