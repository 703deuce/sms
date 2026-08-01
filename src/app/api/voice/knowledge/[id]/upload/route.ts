import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/csv",
  "text/markdown",
  "application/json",
  "text/html",
]);

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: knowledgeBaseId } = await params;

    const kb = await getPrisma().voiceKnowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId: auth.workspaceId },
    });
    if (!kb) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    }
    const contentType = file.type || "application/octet-stream";
    const name = file.name || "upload.bin";
    const extOk = /\.(pdf|docx?|txt|csv|md|json|html?)$/i.test(name);
    if (!ALLOWED.has(contentType) && !extOk) {
      return NextResponse.json(
        { error: "Unsupported type. Use PDF, DOCX, TXT, CSV, MD, JSON, or HTML." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const source = await getPrisma().voiceKnowledgeSource.create({
      data: {
        workspaceId: auth.workspaceId,
        knowledgeBaseId,
        name,
        sourceType: "file",
        status: "pending",
        fileMeta: {
          fileName: name,
          contentType,
          byteLength: bytes.length,
          base64: bytes.toString("base64"),
        },
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
      console.warn("[voice/knowledge/upload] queued", processErr);
      return NextResponse.json({ data: source }, { status: 201 });
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}
