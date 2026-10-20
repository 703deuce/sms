import "server-only";

import { toFile } from "openai";
import { getPrisma } from "@/lib/server/db";
import { getVoiceV3BasicOpenAiClient } from "@/lib/voice-v3-basic/openai-client";

/** Voice V3 uses OpenAI vector stores + LiveKit `FileSearch` — not Telnyx embeddings. */
export function useGptLiveFileSearchRag(): boolean {
  if (process.env.VOICE_KNOWLEDGE_TELNYX_RAG === "1") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function ensureOpenAiVectorStoreForKnowledgeBase(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  displayName: string;
}): Promise<string | null> {
  if (!useGptLiveFileSearchRag()) return null;

  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: input.knowledgeBaseId, workspaceId: input.workspaceId },
    select: { id: true, name: true, openaiVectorStoreId: true },
  });
  if (!kb) return null;

  const existing = kb.openaiVectorStoreId?.trim();
  if (existing) return existing;

  const client = getVoiceV3BasicOpenAiClient();
  const store = await client.vectorStores.create({
    name: `transovo-${input.workspaceId}-${kb.id}`.slice(0, 256),
    metadata: {
      workspaceId: input.workspaceId,
      knowledgeBaseId: kb.id,
      product: "voice_v3",
    },
  });

  await prisma.voiceKnowledgeBase.update({
    where: { id: kb.id },
    data: {
      openaiVectorStoreId: store.id,
      openaiVectorStoreStatus: "ready",
    },
  });

  return store.id;
}

async function waitForVectorStoreFileReady(
  vectorStoreId: string,
  fileId: string,
  maxWaitMs: number,
): Promise<boolean> {
  const client = getVoiceV3BasicOpenAiClient();
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const row = await client.vectorStores.files.retrieve(fileId, {
      vector_store_id: vectorStoreId,
    });
    const status = String(row.status || "").toLowerCase();
    if (status === "completed") return true;
    if (status === "failed" || status === "cancelled") return false;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/**
 * Upload or replace one knowledge source as a text file on the KB's OpenAI vector store.
 */
export async function syncTextSourceToOpenAiVectorStore(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  sourceId: string;
  fileName: string;
  text: string;
}): Promise<{ vectorStoreId: string; fileId: string; indexed: boolean } | null> {
  if (!useGptLiveFileSearchRag()) return null;

  const text = input.text.trim();
  if (!text) return null;

  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: input.knowledgeBaseId, workspaceId: input.workspaceId },
    select: { id: true, name: true },
  });
  if (!kb) return null;

  const vectorStoreId = await ensureOpenAiVectorStoreForKnowledgeBase({
    workspaceId: input.workspaceId,
    knowledgeBaseId: kb.id,
    displayName: kb.name,
  });
  if (!vectorStoreId) return null;

  const client = getVoiceV3BasicOpenAiClient();
  const source = await prisma.voiceKnowledgeSource.findFirst({
    where: { id: input.sourceId, workspaceId: input.workspaceId },
    select: { openaiFileId: true },
  });
  const priorFileId = source?.openaiFileId?.trim();
  if (priorFileId) {
    try {
      await client.vectorStores.files.delete(priorFileId, {
        vector_store_id: vectorStoreId,
      });
    } catch {
      // stale id — continue with fresh upload
    }
  }

  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "source.txt";
  const upload = await client.files.create({
    file: await toFile(Buffer.from(text, "utf8"), safeName.endsWith(".txt") ? safeName : `${safeName}.txt`),
    purpose: "assistants",
  });

  await client.vectorStores.files.create(vectorStoreId, { file_id: upload.id });
  const indexed = await waitForVectorStoreFileReady(vectorStoreId, upload.id, 90_000);

  await prisma.voiceKnowledgeSource.update({
    where: { id: input.sourceId },
    data: { openaiFileId: upload.id },
  });
  await prisma.voiceKnowledgeBase.update({
    where: { id: kb.id },
    data: {
      openaiVectorStoreStatus: indexed ? "ready" : "processing",
      lastEmbeddedAt: new Date(),
    },
  });

  return { vectorStoreId, fileId: upload.id, indexed };
}

export async function waitForOpenAiKnowledgeBaseVectorStore(input: {
  knowledgeBaseId: string;
  maxWaitMs?: number;
}): Promise<{ ready: boolean; status?: string | null }> {
  if (!useGptLiveFileSearchRag()) {
    return { ready: true, status: "disabled" };
  }
  const maxWaitMs = input.maxWaitMs ?? 60_000;
  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findUnique({
    where: { id: input.knowledgeBaseId },
    select: {
      openaiVectorStoreId: true,
      openaiVectorStoreStatus: true,
      sources: {
        where: { status: "indexed", openaiFileId: { not: null } },
        select: { openaiFileId: true },
        take: 20,
      },
    },
  });
  if (!kb?.openaiVectorStoreId) {
    return { ready: false, status: "no_vector_store" };
  }
  const client = getVoiceV3BasicOpenAiClient();
  const started = Date.now();
  for (const src of kb.sources) {
    const fileId = src.openaiFileId?.trim();
    if (!fileId) continue;
    while (Date.now() - started < maxWaitMs) {
      const row = await client.vectorStores.files.retrieve(fileId, {
        vector_store_id: kb.openaiVectorStoreId,
      });
      const status = String(row.status || "").toLowerCase();
      if (status === "completed") {
        await prisma.voiceKnowledgeBase.update({
          where: { id: input.knowledgeBaseId },
          data: { openaiVectorStoreStatus: "ready" },
        });
        return { ready: true, status };
      }
      if (status === "failed" || status === "cancelled") {
        return { ready: false, status };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return { ready: false, status: "timeout" };
  }
  return {
    ready: kb.openaiVectorStoreStatus === "ready",
    status: kb.openaiVectorStoreStatus,
  };
}

export async function listOpenAiVectorStoreIdsForKnowledgeBases(
  workspaceId: string,
  knowledgeBaseIds: string[],
): Promise<string[]> {
  if (!knowledgeBaseIds.length || !useGptLiveFileSearchRag()) return [];
  const prisma = getPrisma();
  const rows = await prisma.voiceKnowledgeBase.findMany({
    where: {
      workspaceId,
      id: { in: knowledgeBaseIds },
      openaiVectorStoreId: { not: null },
    },
    select: { openaiVectorStoreId: true },
  });
  const ids = rows
    .map((r) => r.openaiVectorStoreId?.trim())
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}
