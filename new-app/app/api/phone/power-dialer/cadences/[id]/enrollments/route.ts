import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const rows = await prisma.powerDialerCadenceEnrollment.findMany({
      where: { workspaceId, cadenceId: id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 400);
  }
}
