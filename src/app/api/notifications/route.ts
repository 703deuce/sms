import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
} from "@/lib/notifications/in-app";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "1";
    const limit = Number(searchParams.get("limit") || "30");

    const [items, unread] = await Promise.all([
      listNotifications(auth.workspaceId, auth.session.userId, {
        unreadOnly,
        limit: Number.isFinite(limit) ? limit : 30,
      }),
      countUnread(auth.workspaceId, auth.session.userId),
    ]);

    return NextResponse.json({ data: items, unread });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      all?: boolean;
    };

    if (body.all) {
      const result = await markAllRead(auth.workspaceId, auth.session.userId);
      return NextResponse.json({ ok: true, count: result.count });
    }

    if (!body.id) {
      return NextResponse.json({ error: "id or all required" }, { status: 400 });
    }

    const result = await markRead(auth.workspaceId, auth.session.userId, body.id);
    if (!result.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
