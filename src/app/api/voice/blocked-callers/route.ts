import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.voiceCallerBlock.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { callerE164?: string; reason?: string; sourceCallId?: string };
    const raw = body.callerE164?.trim();
    if (!raw) return NextResponse.json({ error: "callerE164 required" }, { status: 400 });
    const callerE164 = normalizeE164(raw);
    const prisma = getPrisma();
    const row = await prisma.voiceCallerBlock.upsert({
      where: { workspaceId_callerE164: { workspaceId: auth.workspaceId, callerE164 } },
      create: {
        workspaceId: auth.workspaceId,
        callerE164,
        reason: body.reason?.trim() || null,
        sourceCallId: body.sourceCallId?.trim() || null,
      },
      update: {
        reason: body.reason?.trim() || undefined,
        sourceCallId: body.sourceCallId?.trim() || undefined,
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const callerE164 = url.searchParams.get("callerE164");
    if (!callerE164) return NextResponse.json({ error: "callerE164 required" }, { status: 400 });
    const prisma = getPrisma();
    await prisma.voiceCallerBlock.deleteMany({
      where: { workspaceId: auth.workspaceId, callerE164: normalizeE164(callerE164) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
