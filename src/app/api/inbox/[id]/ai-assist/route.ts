import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  generateInboxSuggestions,
  takeoverAiSession,
} from "@/lib/ai-replies/engine";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: conversationId } = await params;
    const assist = await generateInboxSuggestions(auth.workspaceId, conversationId);
    return NextResponse.json({ data: assist });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: conversationId } = await params;
    const body = (await request.json()) as { action?: string };
    if (body.action === "takeover") {
      await takeoverAiSession(conversationId, auth.workspaceId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
