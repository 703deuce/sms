import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadConversations } from "@/lib/voice/conversations";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadConversations(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
