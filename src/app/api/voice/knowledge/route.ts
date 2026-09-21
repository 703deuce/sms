import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  processKnowledgeSource,
  waitForKnowledgeBaseEmbedding,
} from "@/lib/voice/knowledge-processor";
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

    // Wizard website scan: create/find KB + URL source + process for preview.
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

      let source = await prisma.voiceKnowledgeSource.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          knowledgeBaseId: kb.id,
          crawlUrl: normalized,
        },
      });
      if (!source) {
        source = await prisma.voiceKnowledgeSource.create({
          data: {
            workspaceId: auth.workspaceId,
            knowledgeBaseId: kb.id,
            sourceType: "url",
            name: kbName,
            status: "pending",
            crawlUrl: normalized,
          },
        });
      } else {
        source = await prisma.voiceKnowledgeSource.update({
          where: { id: source.id },
          data: { status: "pending", errorMessage: null, crawlUrl: normalized },
        });
      }

      try {
        await processKnowledgeSource(source.id);
      } catch (err) {
        console.warn(
          "[voice/knowledge] scan_website process failed",
          err instanceof Error ? err.message : err,
        );
      }

      const embedWait = await waitForKnowledgeBaseEmbedding({
        knowledgeBaseId: kb.id,
        maxWaitMs: 60_000,
      });

      const indexed = await prisma.voiceKnowledgeSource.findUnique({
        where: { id: source.id },
      });
      const revision = computeKnowledgeRevisionFingerprint(
        { knowledgeItems: [], knowledgeBaseEnabled: true },
        [kb.id],
      );
      return NextResponse.json({
        data: {
          knowledgeBaseId: kb.id,
          source: indexed,
          sourceStatus: indexed?.status,
          chunkCount: indexed?.chunkCount,
          extractedPreview: indexed?.extractedPreview || indexed?.contentText,
          contentText: indexed?.contentText,
          errorMessage: indexed?.errorMessage,
          knowledgeBaseRevision: revision,
          embeddingReady: embedWait.ready,
          embeddingStatus: embedWait.status,
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
