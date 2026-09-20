import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  blockCallerForWorkspace,
  listBlockedCallers,
  unblockCallerForWorkspace,
} from "@/lib/voice-v3/spam-protection/blocklist";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await listBlockedCallers(auth.workspaceId);
    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        callerE164: r.callerE164,
        displayName: r.displayName,
        createdAt: r.createdAt.toISOString(),
        sourceCallId: r.sourceCallId,
      })),
      count: rows.length,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const phone = String(body.phoneE164 || body.callerE164 || "");
    if (!phone) return jsonError(new Error("callerE164 required"), 400);
    const result = await blockCallerForWorkspace({
      workspaceId: auth.workspaceId,
      callerE164: phone,
      blockedByUserId: auth.session.userId,
      displayName: body.displayName ? String(body.displayName) : null,
      sourceCallId: body.sourceCallId ? String(body.sourceCallId) : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, callerE164: result.callerE164 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const phone = url.searchParams.get("callerE164") || url.searchParams.get("phoneE164") || "";
    if (!phone) return jsonError(new Error("callerE164 required"), 400);
    await unblockCallerForWorkspace({
      workspaceId: auth.workspaceId,
      callerE164: phone,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
