import { getPrisma } from "@/lib/db";
import type { VoiceKnowledgeSource } from "@prisma/client";
import {
  isTelnyxRagConfigured,
  similaritySearch,
  syncFileSourceToTelnyx,
  syncTextSourceToTelnyx,
  syncUrlSourceToTelnyx,
} from "./telnyx/rag";

const CHUNK_SIZE = 800;
/** Keep a short local preview for UI; full docs live in Telnyx RAG. */
const LOCAL_TEXT_CAP = 8_000;

export async function processKnowledgeSource(sourceId: string) {
  const prisma = getPrisma();
  const source = await prisma.voiceKnowledgeSource.findUnique({
    where: { id: sourceId },
    include: { knowledgeBase: true },
  });
  if (!source) throw new Error("Source not found");

  // prisma-compat may omit includes if RELATIONS is incomplete — load KB explicitly.
  const knowledgeBase =
    source.knowledgeBase ||
    (await prisma.voiceKnowledgeBase.findFirst({
      where: { id: source.knowledgeBaseId, workspaceId: source.workspaceId },
    }));
  if (!knowledgeBase) {
    throw new Error(`Knowledge base ${source.knowledgeBaseId} not found for source`);
  }

  await prisma.voiceKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: "processing" },
  });

  try {
    let text = source.contentText || source.extractedPreview || "";
    let bucketName = knowledgeBase.telnyxBucketName;
    let objectKey = source.telnyxObjectKey;
    let taskId: string | null = null;
    let ragMode: "telnyx" | "mock" | "local" = "local";

    if (source.sourceType === "file" && source.fileMeta) {
      const meta = source.fileMeta as {
        base64?: string;
        contentType?: string;
        fileName?: string;
        byteLength?: number;
      };
      if (meta.base64) {
        const bytes = Buffer.from(meta.base64, "base64");
        const sync = await syncFileSourceToTelnyx({
          workspaceId: source.workspaceId,
          knowledgeBaseId: source.knowledgeBaseId,
          sourceId: source.id,
          fileName: meta.fileName || source.name,
          contentType: meta.contentType || "application/octet-stream",
          bytes,
          existingBucketName: bucketName,
        });
        ragMode = sync.mode === "telnyx" ? "telnyx" : "mock";
        bucketName = sync.bucketName || bucketName;
        objectKey = sync.objectKey || objectKey;
        taskId = sync.taskId;
        // Extract text preview for searchable UI when possible (txt/csv/json).
        const ct = (meta.contentType || "").toLowerCase();
        if (
          ct.includes("text/") ||
          ct.includes("csv") ||
          ct.includes("json") ||
          /\.(txt|csv|json|md)$/i.test(meta.fileName || "")
        ) {
          text = bytes.toString("utf8").slice(0, LOCAL_TEXT_CAP);
        } else {
          text = text || `[Binary file uploaded for RAG: ${meta.fileName || source.name}]`;
        }
        // Drop base64 from DB after sync to avoid bloating rows.
        await prisma.voiceKnowledgeSource.update({
          where: { id: sourceId },
          data: {
            fileMeta: {
              contentType: meta.contentType,
              fileName: meta.fileName,
              byteLength: meta.byteLength || bytes.length,
              syncedToTelnyx: sync.mode === "telnyx",
            },
          },
        });
      }
    } else if (source.crawlUrl) {
      if (isTelnyxRagConfigured()) {
        const sync = await syncUrlSourceToTelnyx({
          workspaceId: source.workspaceId,
          knowledgeBaseId: source.knowledgeBaseId,
          url: source.crawlUrl,
          existingBucketName: bucketName,
        });
        ragMode = sync.mode === "telnyx" ? "telnyx" : "mock";
        bucketName = sync.bucketName || bucketName;
        taskId = sync.taskId;
        // Keep a light local preview via single-page fetch for UI search fallback.
        try {
          const res = await fetch(source.crawlUrl, {
            headers: { "User-Agent": "Transovo-KnowledgeBot/1.0" },
          });
          text = (await res.text())
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, LOCAL_TEXT_CAP);
        } catch {
          text = `URL queued for Telnyx crawl/embed: ${source.crawlUrl}`;
        }
      } else {
        const res = await fetch(source.crawlUrl, {
          headers: { "User-Agent": "Transovo-KnowledgeBot/1.0" },
        });
        text = (await res.text())
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    } else if (text) {
      const sync = await syncTextSourceToTelnyx({
        workspaceId: source.workspaceId,
        knowledgeBaseId: source.knowledgeBaseId,
        sourceId: source.id,
        fileName: `${source.name || "faq"}.txt`,
        text,
        existingBucketName: bucketName,
      });
      ragMode = sync.mode === "telnyx" ? "telnyx" : "mock";
      bucketName = sync.bucketName || bucketName;
      objectKey = sync.objectKey || objectKey;
      taskId = sync.taskId;
    }

    if (!text && ragMode === "local") throw new Error("No extractable text");

    const chunks = chunkText(text || "", CHUNK_SIZE);
    const preview = (text || source.name || "").slice(0, 500);

    if (bucketName) {
      await prisma.voiceKnowledgeBase.update({
        where: { id: source.knowledgeBaseId },
        data: {
          telnyxBucketName: bucketName,
          telnyxEmbeddingStatus: taskId ? "processing" : ragMode === "telnyx" ? "ready" : "local",
          telnyxEmbeddingTaskId: taskId,
          lastEmbeddedAt: new Date(),
        },
      });
    }

    await prisma.voiceKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "indexed",
        extractedPreview: preview,
        chunkCount: chunks.length || 1,
        contentText: (text || "").slice(0, LOCAL_TEXT_CAP),
        telnyxObjectKey: objectKey,
        lastSyncedAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      chunks: chunks.length || 1,
      preview,
      ragMode,
      bucketName,
      taskId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.voiceKnowledgeSource.update({
      where: { id: sourceId },
      data: { status: "failed", errorMessage: msg },
    });
    throw err;
  }
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function searchKnowledge(
  workspaceId: string,
  knowledgeBaseId: string,
  query: string,
) {
  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: knowledgeBaseId, workspaceId },
  });
  if (!kb) return [];

  // Prefer Telnyx vector similarity search when the bucket is embedded.
  if (kb.telnyxBucketName && isTelnyxRagConfigured()) {
    try {
      const res = await similaritySearch(kb.telnyxBucketName, query, 8);
      const hits = (res.data || []).map((row, i) => ({
        sourceId: `telnyx-${i}`,
        name: row.filename || kb.name,
        snippet: (row.document_chunk || "").slice(0, 280),
        distance: row.distance,
        provider: "telnyx_rag" as const,
      }));
      if (hits.length) return hits;
    } catch (err) {
      console.warn("[knowledge] Telnyx similarity search failed, falling back", err);
    }
  }

  const sources: VoiceKnowledgeSource[] = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId,
      knowledgeBaseId,
      status: "indexed",
    },
  });
  const q = query.toLowerCase();
  return sources
    .filter((s) => (s.contentText || s.extractedPreview || "").toLowerCase().includes(q))
    .map((s) => ({
      sourceId: s.id,
      name: s.name,
      snippet: extractSnippet(s.contentText || s.extractedPreview || "", q),
      provider: "local" as const,
    }));
}

function extractSnippet(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, 200);
  const start = Math.max(0, idx - 80);
  return text.slice(start, start + 200);
}

/** List Telnyx bucket names assigned to an agent (via KB links or config). */
export async function getAgentRagBucketIds(workspaceId: string, agentId: string) {
  const prisma = getPrisma();
  // Avoid depending on include hydration — fetch KB ids then bucket names.
  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { agentId, workspaceId },
    select: { knowledgeBaseId: true },
  });
  const kbIds = links
    .map((l: { knowledgeBaseId: string }) => l.knowledgeBaseId)
    .filter(Boolean);

  if (kbIds.length) {
    const linked = await prisma.voiceKnowledgeBase.findMany({
      where: {
        workspaceId,
        id: { in: kbIds },
        telnyxBucketName: { not: null },
      },
      select: { telnyxBucketName: true },
    });
    const fromLinks = linked
      .map((k: { telnyxBucketName: string | null }) => k.telnyxBucketName)
      .filter((b: string | null): b is string => Boolean(b));
    if (fromLinks.length) return [...new Set(fromLinks)];
  }

  // Fallback: all workspace KBs with buckets (until agent links are set).
  const kbs = await prisma.voiceKnowledgeBase.findMany({
    where: { workspaceId, status: "active", telnyxBucketName: { not: null } },
    select: { telnyxBucketName: true },
    take: 10,
  });
  return kbs
    .map((k: { telnyxBucketName: string | null }) => k.telnyxBucketName)
    .filter((b: string | null): b is string => Boolean(b));
}
