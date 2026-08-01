import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listPresence, setPresence } from "@/lib/phone/presence-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await listPresence(auth.workspaceId);
    const me =
      rows.find((r: { userId: string }) => r.userId === auth.session.userId) || null;
    return NextResponse.json({
      data: rows,
      me: auth.session.userId,
      mine: me,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      status?: string;
      customLabel?: string | null;
      queueAvailable?: boolean;
      userId?: string;
    };
    if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 });
    const targetUserId = body.userId || auth.session.userId;
    // Only admins may set another user's presence.
    if (targetUserId !== auth.session.userId) {
      const { requireSoftphonePermission } = await import("@/lib/phone/softphone-permissions");
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "admin_settings");
    }
    const row = await setPresence({
      workspaceId: auth.workspaceId,
      userId: targetUserId,
      status: body.status,
      customLabel: body.customLabel,
      queueAvailable: body.queueAvailable,
      // Softphone auto on_call omits customLabel so pre_call restore tags survive.
      touchCustomLabel: Object.prototype.hasOwnProperty.call(body, "customLabel"),
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
