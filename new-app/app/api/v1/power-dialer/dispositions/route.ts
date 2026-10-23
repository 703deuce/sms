import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";

export async function GET(request: Request) {
  return withPublicApi(request, "dispositions:read", async (ctx) => {
    const url = new URL(request.url);
    const attemptId = url.searchParams.get("attemptId");
    const prisma = getPrisma();
    if (attemptId) {
      const attempt = await prisma.powerDialerAttempt.findFirst({
        where: { id: attemptId, workspaceId: ctx.workspaceId },
        select: {
          id: true,
          disposition: true,
          notes: true,
          contactId: true,
          sessionId: true,
          endedAt: true,
        },
      });
      if (!attempt) {
        return NextResponse.json({ error: { code: "not_found", message: "Attempt not found" } }, { status: 404 });
      }
      return NextResponse.json({ data: attempt });
    }
    const defs = await prisma.powerDialerDisposition.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, outcomeClass: true, hotkey: true },
    });
    return NextResponse.json({ data: defs });
  });
}
