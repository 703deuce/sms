import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { getPrisma } from "@/lib/server/db";
import { exportListContactsCsv } from "@/lib/server/phone/power-dialer/list-members";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: listId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const prisma = getPrisma();
    const membership = await prisma.membership.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    if (!membership || membership.role === "READ_ONLY") {
      return NextResponse.json({ error: "Export not permitted" }, { status: 403 });
    }
    const csv = await exportListContactsCsv(workspaceId, listId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="list-${listId}.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
