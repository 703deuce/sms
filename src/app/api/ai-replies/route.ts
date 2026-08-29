import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createAiReply, listAiReplies } from "@/lib/ai-replies/service";
import type { CreateAiReplyInput } from "@/lib/ai-replies/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listAiReplies(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as CreateAiReplyInput;
    const data = await createAiReply(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
