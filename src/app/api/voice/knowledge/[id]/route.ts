import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const kb = await getPrisma().voiceKnowledgeBase.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!kb) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sources = await getPrisma().voiceKnowledgeSource.findMany({
      where: { knowledgeBaseId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: { ...kb, sources } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
