import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { setId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { label?: string; category?: string };
    const prisma = getPrisma();
    const set = await prisma.powerDialerDispositionSet.findFirst({ where: { id: setId, workspaceId } });
    if (!set) throw new Error("Set not found");
    const max = await prisma.powerDialerDisposition.aggregate({
      where: { setId },
      _max: { sortOrder: true },
    });
    const data = await prisma.powerDialerDisposition.create({
      data: {
        setId,
        label: body.label?.trim() || "New outcome",
        category: body.category?.trim() || "outcome",
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
