import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: knowledgeBaseId } = await params;
    const body = (await request.json()) as {
      name?: string;
      sourceType?: string;
      contentText?: string;
      crawlUrl?: string;
    };

    const kb = await getPrisma().voiceKnowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId: auth.workspaceId },
    });
    if (!kb) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const source = await getPrisma().voiceKnowledgeSource.create({
      data: {
        workspaceId: auth.workspaceId,
        knowledgeBaseId,
        name: body.name || "Source",
        sourceType: body.sourceType || "text",
        contentText: body.contentText,
        crawlUrl: body.crawlUrl,
        status: "pending",
      },
    });

    try {
      const { processKnowledgeSource } = await import("@/lib/voice/knowledge-processor");
      await processKnowledgeSource(source.id);
      const indexed = await getPrisma().voiceKnowledgeSource.findUnique({
        where: { id: source.id },
      });
      return NextResponse.json({ data: indexed }, { status: 201 });
    } catch (processErr) {
      await enqueueJob({
        jobType: "voice_knowledge_process",
        queueName: "voice-calls",
        workspaceId: auth.workspaceId,
        payload: { sourceId: source.id },
        idempotencyKey: `voice-kb-process-${source.id}`,
      });
      console.warn("[voice/knowledge] sync process failed, queued job", processErr);
      return NextResponse.json({ data: source }, { status: 201 });
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}
