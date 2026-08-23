import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const limit = Math.min(
      Number(new URL(request.url).searchParams.get("limit") || "50"),
      100,
    );
    const prisma = getPrisma();
    const rows = await prisma.smartRoutingOutboundCall.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        authorizedCaller: { select: { name: true } },
      },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err);
  }
}
