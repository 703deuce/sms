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
      customLabel?: string;
      queueAvailable?: boolean;
      userId?: string;
    };
    if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 });
    const row = await setPresence({
      workspaceId: auth.workspaceId,
      userId: body.userId || auth.session.userId,
      status: body.status,
      customLabel: body.customLabel,
      queueAvailable: body.queueAvailable,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
