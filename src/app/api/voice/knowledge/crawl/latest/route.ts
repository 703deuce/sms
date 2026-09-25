import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const knowledgeBaseId = url.searchParams.get("knowledgeBaseId")?.trim();
    if (!knowledgeBaseId) {
      return NextResponse.json({ error: "knowledgeBaseId is required" }, { status: 400 });
    }
    const prisma = getPrisma();
    const job = await prisma.voiceWebsiteCrawlJob.findFirst({
      where: { workspaceId: auth.workspaceId, knowledgeBaseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        rootUrl: true,
        errorSummary: true,
        suggestions: true,
        stats: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ data: job });
  } catch (err) {
    return jsonError(err, 500);
  }
}
