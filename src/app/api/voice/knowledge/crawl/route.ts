import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enqueueVoiceWebsiteCrawlJob } from "@/lib/voice-v3/knowledge/website-crawl/run-crawl-job";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      knowledgeBaseId?: string;
      websiteUrl?: string;
    };
    const knowledgeBaseId = String(body.knowledgeBaseId || "").trim();
    const websiteUrl = String(body.websiteUrl || "").trim();
    if (!knowledgeBaseId || !websiteUrl) {
      return NextResponse.json(
        { error: "knowledgeBaseId and websiteUrl are required" },
        { status: 400 },
      );
    }
    const normalized = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    const prisma = getPrisma();
    const kb = await prisma.voiceKnowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!kb) {
      return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
    }
    const { crawlJobId } = await enqueueVoiceWebsiteCrawlJob({
      workspaceId: auth.workspaceId,
      knowledgeBaseId,
      rootUrl: normalized,
    });
    return NextResponse.json({
      data: { crawlJobId, crawlStatus: "DISCOVERING" },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
