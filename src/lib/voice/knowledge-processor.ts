import { getPrisma } from "@/lib/db";
import type { VoiceKnowledgeSource } from "@prisma/client";

const CHUNK_SIZE = 800;

export async function processKnowledgeSource(sourceId: string) {
  const prisma = getPrisma();
  const source = await prisma.voiceKnowledgeSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new Error("Source not found");

  await prisma.voiceKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: "processing" },
  });

  try {
    let text = source.contentText || source.extractedPreview || "";
    if (source.crawlUrl) {
      const res = await fetch(source.crawlUrl, {
        headers: { "User-Agent": "Transovo-KnowledgeBot/1.0" },
      });
      text = await res.text();
      // Strip HTML roughly
      text = text.replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (!text) throw new Error("No extractable text");

    const chunks = chunkText(text, CHUNK_SIZE);
    const preview = text.slice(0, 500);

    await prisma.voiceKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "indexed",
        extractedPreview: preview,
        chunkCount: chunks.length,
        contentText: text.slice(0, 50_000),
        lastSyncedAt: new Date(),
        errorMessage: null,
      },
    });

    return { chunks: chunks.length, preview };
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
  const sources: VoiceKnowledgeSource[] = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId,
      knowledgeBaseId,
      status: "indexed",
    },
  });
  const q = query.toLowerCase();
  const hits = sources
    .filter((s) => (s.contentText || s.extractedPreview || "").toLowerCase().includes(q))
    .map((s) => ({
      sourceId: s.id,
      name: s.name,
      snippet: extractSnippet(s.contentText || s.extractedPreview || "", q),
    }));
  return hits;
}

function extractSnippet(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text.slice(0, 200);
  const start = Math.max(0, idx - 80);
  return text.slice(start, start + 200);
}
