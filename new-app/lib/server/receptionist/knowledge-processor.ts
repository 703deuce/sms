import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  syncTextSourceToOpenAiVectorStore,
  useGptLiveFileSearchRag,
} from "@/lib/server/voice-v3/knowledge/gpt-live-file-search-rag";

const LOCAL_TEXT_CAP = 8_000;

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [text];
}

async function extractTextFromFileSource(source: {
  name: string;
  contentText: string | null;
  fileMeta: unknown;
}): Promise<string> {
  if (source.contentText?.trim()) return source.contentText.trim();
  const meta = source.fileMeta as {
    base64?: string;
    contentType?: string;
    fileName?: string;
  } | null;
  if (!meta?.base64) return "";
  const bytes = Buffer.from(meta.base64, "base64");
  const ct = (meta.contentType || "").toLowerCase();
  const name = meta.fileName || source.name;
  if (
    ct.includes("text/") ||
    ct.includes("csv") ||
    ct.includes("json") ||
    /\.(txt|csv|json|md|html?)$/i.test(name)
  ) {
    return bytes.toString("utf8").slice(0, LOCAL_TEXT_CAP);
  }
  return `[Uploaded document: ${name}. Use file_search for full content when indexed.]`;
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Transovo-KnowledgeBot/1.0" },
  });
  const raw = await res.text();
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LOCAL_TEXT_CAP);
}

/** Index one knowledge source into OpenAI vector store (GPT Live file search). */
export async function processReceptionistKnowledgeSource(sourceId: string): Promise<void> {
  const prisma = getPrisma();
  const source = await prisma.voiceKnowledgeSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new Error("Source not found");

  await prisma.voiceKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: "processing", errorMessage: null },
  });

  try {
    let text = source.contentText?.trim() || source.extractedPreview?.trim() || "";

    if (source.sourceType === "faq" && text) {
      const q = (source.fileMeta as { question?: string })?.question || source.name;
      text = `FAQ\nQuestion: ${q}\nAnswer: ${text}`;
    } else if (source.sourceType === "file") {
      text = await extractTextFromFileSource(source);
      const meta = source.fileMeta as { base64?: string; contentType?: string; fileName?: string; byteLength?: number };
      if (meta?.base64 && useGptLiveFileSearchRag()) {
        await prisma.voiceKnowledgeSource.update({
          where: { id: sourceId },
          data: {
            fileMeta: {
              contentType: meta.contentType,
              fileName: meta.fileName,
              byteLength: meta.byteLength,
            },
          },
        });
      }
    } else if (source.crawlUrl) {
      text = text || (await fetchUrlText(source.crawlUrl));
    }

    if (!text.trim()) {
      throw new Error("No extractable text for this source");
    }

    if (useGptLiveFileSearchRag()) {
      const openAi = await syncTextSourceToOpenAiVectorStore({
        workspaceId: source.workspaceId,
        knowledgeBaseId: source.knowledgeBaseId,
        sourceId: source.id,
        fileName: source.name || source.crawlUrl || "knowledge",
        text,
      });
      if (!openAi) {
        throw new Error("OpenAI vector store sync unavailable (missing API key?)");
      }
    }

    const chunks = chunkText(text, 800);
    await prisma.voiceKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "indexed",
        extractedPreview: text.slice(0, 500),
        chunkCount: chunks.length,
        contentText: text.slice(0, LOCAL_TEXT_CAP),
        lastSyncedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceKnowledgeSource.update({
      where: { id: sourceId },
      data: { status: "failed", errorMessage: message },
    });
    throw err;
  }
}

export async function processPendingKnowledgeSourcesForWorkspace(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const pending = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId,
      status: { in: ["pending", "ready", "processing"] },
    },
    select: { id: true },
    take: 50,
  });
  for (const row of pending) {
    try {
      await processReceptionistKnowledgeSource(row.id);
    } catch {
      // leave failed status on row; continue other sources
    }
  }
}
