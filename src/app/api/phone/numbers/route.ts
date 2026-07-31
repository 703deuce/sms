import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { e164: "asc" },
      select: { id: true, e164: true, friendlyName: true, status: true },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}
