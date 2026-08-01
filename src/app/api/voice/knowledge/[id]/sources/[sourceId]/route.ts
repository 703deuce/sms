import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id, sourceId } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };

    const source = await getPrisma().voiceKnowledgeSource.findFirst({
      where: { id: sourceId, knowledgeBaseId: id, workspaceId: auth.workspaceId },
    });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "reindex") {
      await getPrisma().voiceKnowledgeSource.update({
        where: { id: sourceId },
        data: { status: "pending", errorMessage: null },
      });
      try {
        const { processKnowledgeSource } = await import("@/lib/voice/knowledge-processor");
        await processKnowledgeSource(sourceId);
      } catch {
        await enqueueJob({
          jobType: "voice_knowledge_process",
          queueName: "voice-calls",
          workspaceId: auth.workspaceId,
          payload: { sourceId },
          idempotencyKey: `voice-kb-reindex-${sourceId}-${Date.now()}`,
        });
      }
      const updated = await getPrisma().voiceKnowledgeSource.findUnique({
        where: { id: sourceId },
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id, sourceId } = await params;
    const source = await getPrisma().voiceKnowledgeSource.findFirst({
      where: { id: sourceId, knowledgeBaseId: id, workspaceId: auth.workspaceId },
    });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (source.telnyxObjectKey) {
      const kb = await getPrisma().voiceKnowledgeBase.findUnique({ where: { id } });
      if (kb?.telnyxBucketName) {
        try {
          const { deleteKnowledgeObject } = await import("@/lib/voice/telnyx/storage");
          await deleteKnowledgeObject(kb.telnyxBucketName, source.telnyxObjectKey);
          const { embedBucket } = await import("@/lib/voice/telnyx/rag");
          await embedBucket(kb.telnyxBucketName).catch(() => undefined);
        } catch (err) {
          console.warn("[knowledge] delete object failed", err);
        }
      }
    }

    await getPrisma().voiceKnowledgeSource.delete({ where: { id: sourceId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
