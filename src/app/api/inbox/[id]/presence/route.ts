import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getPresentUsers, recordPresence } from "@/lib/inbox/presence";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const exists = await getPrisma().conversation.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const viewers = getPresentUsers(id, auth.session.userId);
    return NextResponse.json({ data: { viewers } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { userId?: string };

    const userId = body.userId?.trim() || auth.session.userId;
    if (userId !== auth.session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const exists = await getPrisma().conversation.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const viewers = recordPresence(id, userId, auth.session.name);
    return NextResponse.json({ data: { viewers } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
