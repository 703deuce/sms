import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit") || 10)));

    const prisma = getPrisma();
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const rows = await prisma.voiceTransfer.findMany({
      where: { workspaceId: auth.workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        call: {
          select: { id: true, fromE164: true, startedAt: true },
        },
      },
    });

    const data = rows.map((t) => {
      const meta = (t.metadata || {}) as Record<string, unknown>;
      return {
        id: t.id,
        callId: t.callId,
        createdAt: t.createdAt.toISOString(),
        callerE164: t.call?.fromE164 ?? null,
        destination: t.destination,
        transferType: t.transferType,
        status: t.status,
        answered: t.answered,
        transferMode:
          typeof meta.transferMode === "string"
            ? meta.transferMode
            : typeof meta.mode === "string"
              ? meta.mode
              : null,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
