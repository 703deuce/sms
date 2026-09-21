import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.voiceKnowledgeGap.findMany({
      where: { workspaceId: auth.workspaceId, status: "OPEN" },
      orderBy: [{ timesAsked: "desc" }, { lastAskedAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { id?: string; status?: string };
    const id = String(body.id || "");
    const status = String(body.status || "").toUpperCase();
    if (!id || !["ANSWERED", "IGNORED", "OPEN"].includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const prisma = getPrisma();
    const updated = await prisma.voiceKnowledgeGap.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: { status },
    });
    if (!updated.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
