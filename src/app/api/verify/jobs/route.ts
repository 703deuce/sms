import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const data = await prisma.verifyBulkJob.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
