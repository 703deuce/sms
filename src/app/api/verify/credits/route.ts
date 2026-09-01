import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getVerifyCreditBalance } from "@/lib/verify/verify-credits";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const balance = await getVerifyCreditBalance(auth.workspaceId);
    const prisma = getPrisma();
    const recent = await prisma.verifyCreditLedger.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ data: { balance, recent } });
  } catch (err) {
    return jsonError(err);
  }
}
