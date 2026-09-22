import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { blockCallerForWorkspace } from "@/lib/voice-v3/spam-protection/blocklist";
import { getPrisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const prisma = getPrisma();
    const call = await prisma.voiceCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { fromE164: true },
    });
    if (!call?.fromE164) {
      return NextResponse.json({ error: "Call or caller number not found" }, { status: 404 });
    }

    const result = await blockCallerForWorkspace({
      workspaceId: auth.workspaceId,
      callerE164: call.fromE164,
      blockedByUserId: auth.session.userId,
      sourceCallId: id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, callerE164: result.callerE164 });
  } catch (err) {
    return jsonError(err);
  }
}
