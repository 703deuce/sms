import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enqueueVoiceWebsiteCrawlJob } from "@/lib/voice-v3/knowledge/website-crawl/run-crawl-job";
import { computeKnowledgeRevisionFingerprint } from "@/lib/voice-receptionist-wizard/knowledge-config";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceKnowledgeBase.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      description?: string;
      url?: string;
      knowledgeBaseId?: string;
    };

    if (body.action === "scan_website") {
      const url = String(body.url || "").trim();
      if (!url) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
      }
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      const prisma = getPrisma();
      const kbName = (body.name || "Website knowledge").trim();

      let kb = body.knowledgeBaseId
        ? await prisma.voiceKnowledgeBase.findFirst({
            where: { id: body.knowledgeBaseId, workspaceId: auth.workspaceId },
          })
        : null;
      if (!kb) {
        kb = await prisma.voiceKnowledgeBase.create({
          data: {
            workspaceId: auth.workspaceId,
            name: kbName,
            description: `Scanned from ${normalized}`,
            status: "active",
          },
        });
      }

      const { crawlJobId } = await enqueueVoiceWebsiteCrawlJob({
        workspaceId: auth.workspaceId,
        knowledgeBaseId: kb.id,
        rootUrl: normalized,
      });

      const revision = computeKnowledgeRevisionFingerprint(
        { knowledgeItems: [], knowledgeBaseEnabled: true, websiteUrl: normalized },
        [kb.id],
      );
      return NextResponse.json({
        data: {
          knowledgeBaseId: kb.id,
          crawlJobId,
          crawlStatus: "DISCOVERING",
          knowledgeBaseRevision: revision,
          embeddingReady: false,
          embeddingStatus: "crawl_queued",
        },
      });
    }

    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const row = await getPrisma().voiceKnowledgeBase.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        description: body.description,
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
