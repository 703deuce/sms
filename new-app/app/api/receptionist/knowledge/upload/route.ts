import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { processReceptionistKnowledgeSource } from "@/lib/server/receptionist/knowledge-processor";
import { resolveWorkspaceId } from "@/lib/server/workspace";

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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
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

    const prisma = getPrisma();
    let kb = await prisma.voiceKnowledgeBase.findFirst({
      where: { workspaceId, status: "active" },
    });
    if (!kb) {
      kb = await prisma.voiceKnowledgeBase.create({
        data: { workspaceId, name: "Receptionist knowledge", status: "active" },
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const source = await prisma.voiceKnowledgeSource.create({
      data: {
        workspaceId,
        knowledgeBaseId: kb.id,
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
      await processReceptionistKnowledgeSource(source.id);
    } catch (processErr) {
      console.warn("[receptionist/knowledge/upload] process failed", processErr);
    }

    const indexed = await prisma.voiceKnowledgeSource.findUnique({ where: { id: source.id } });
    return NextResponse.json({ data: indexed }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
