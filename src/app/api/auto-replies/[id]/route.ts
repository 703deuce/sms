import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteAutoReply,
  duplicateAutoReply,
  getAutoReply,
  setAutoReplyStatus,
  updateAutoReply,
} from "@/lib/auto-replies/service";
import type { CreateAutoReplyInput } from "@/lib/auto-replies/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const data = await getAutoReply(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<CreateAutoReplyInput> & {
      action?: "duplicate" | "toggle_status";
    };

    if (body.action === "duplicate") {
      const data = await duplicateAutoReply(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (body.action === "toggle_status") {
      const current = await getAutoReply(auth.workspaceId, id);
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const data = await setAutoReplyStatus(
        auth.workspaceId,
        id,
        current.status === "active" ? "paused" : "active",
      );
      return NextResponse.json({ data });
    }

    const data = await updateAutoReply(auth.workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    await deleteAutoReply(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
