import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { searchKnowledge } from "@/lib/voice/knowledge-processor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { query?: string };
    if (!body.query?.trim()) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }
    const hits = await searchKnowledge(auth.workspaceId, id, body.query.trim());
    return NextResponse.json({ data: hits });
  } catch (err) {
    return jsonError(err, 400);
  }
}
