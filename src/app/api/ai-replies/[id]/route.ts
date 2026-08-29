import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteAiReply,
  duplicateAiReply,
  getAiReply,
  updateAiReply,
} from "@/lib/ai-replies/service";
import type { CreateAiReplyInput } from "@/lib/ai-replies/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getAiReply(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as Partial<CreateAiReplyInput> & {
      action?: "duplicate" | "toggle_status";
    };

    if (body.action === "duplicate") {
      const data = await duplicateAiReply(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (body.action === "toggle_status") {
      const current = await getAiReply(auth.workspaceId, id);
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const data = await updateAiReply(auth.workspaceId, id, {
        status: current.status === "active" ? "paused" : "active",
      });
      return NextResponse.json({ data });
    }

    const data = await updateAiReply(auth.workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deleteAiReply(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
