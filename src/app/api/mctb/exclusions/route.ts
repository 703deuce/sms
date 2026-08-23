import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.suppression.findMany({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ source: "mctb_exclusion" }, { source: "personal_blocked" }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const phone = normalizeE164(String(body.phone || ""));
    const reason = String(body.reason || "Do not text").trim();
    const key = `${auth.workspaceId}:mctb:${phone}`;
    const prisma = getPrisma();
    const row = await prisma.suppression.upsert({
      where: { suppressionKey: key },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        suppressionKey: key,
        source: "mctb_exclusion",
        reason,
      },
      update: { reason },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(new Error("id required"), 400);
    const prisma = getPrisma();
    await prisma.suppression.deleteMany({
      where: { id, workspaceId: auth.workspaceId, source: "mctb_exclusion" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
