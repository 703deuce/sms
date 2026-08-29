import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createAutoReply, listAutoReplies } from "@/lib/auto-replies/service";
import type { CreateAutoReplyInput } from "@/lib/auto-replies/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listAutoReplies(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as CreateAutoReplyInput;
    const data = await createAutoReply(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
