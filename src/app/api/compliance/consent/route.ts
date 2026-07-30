import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().consentRecord.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { consentDate: "desc" },
      take: 200,
      include: { contact: { select: { firstName: true, lastName: true, status: true } } },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
