import "server-only";

import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/server/db";
import type { KnowledgeCompileSlice } from "@/lib/server/voice-v3/editor-to-voice-v3-config";
import { listOpenAiVectorStoreIdsForKnowledgeBases } from "@/lib/server/voice-v3/knowledge/gpt-live-file-search-rag";
import { processPendingKnowledgeSourcesForWorkspace } from "@/lib/server/receptionist/knowledge-processor";

async function activeKnowledgeBaseIds(workspaceId: string, agentId: string): Promise<string[]> {
  const prisma = getPrisma();
  const ids = new Set<string>();

  const bases = await prisma.voiceKnowledgeBase.findMany({
    where: { workspaceId, status: "active" },
    select: { id: true },
  });
  for (const kb of bases) ids.add(kb.id);

  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { workspaceId, agentId },
    select: { knowledgeBaseId: true },
  });
  for (const row of links) {
    if (row.knowledgeBaseId) ids.add(row.knowledgeBaseId);
  }

  return [...ids];
}

function revisionFingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

export async function buildKnowledgeCompileSlice(input: {
  workspaceId: string;
  agentId: string;
}): Promise<KnowledgeCompileSlice> {
  const prisma = getPrisma();
  const knowledgeBaseIds = await activeKnowledgeBaseIds(input.workspaceId, input.agentId);

  const faqSources = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId: input.workspaceId,
      sourceType: "faq",
      status: { in: ["ready", "indexed", "published"] },
      ...(knowledgeBaseIds.length
        ? { knowledgeBaseId: { in: knowledgeBaseIds } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const faqFacts = faqSources
    .map((s) => {
      const q = (s.fileMeta as { question?: string })?.question || s.name;
      const a = s.contentText?.trim() || "";
      if (!q?.trim() || !a) return null;
      return `Q: ${q.trim()}\nA: ${a.trim()}`;
    })
    .filter((x): x is string => Boolean(x));

  const knowledgeItemSummaries = faqSources
    .map((s) => {
      const q = (s.fileMeta as { question?: string })?.question || s.name;
      const a = s.contentText?.trim() || "";
      if (!q?.trim() || !a) return null;
      return { id: s.id, label: q.trim(), summary: a.trim() };
    })
    .filter((x): x is { id: string; label: string; summary: string } => Boolean(x));

  const documentSourceIds = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "indexed",
      ...(knowledgeBaseIds.length
        ? { knowledgeBaseId: { in: knowledgeBaseIds } }
        : {}),
    },
    select: { id: true },
  });

  const openaiVectorStoreIds = await listOpenAiVectorStoreIdsForKnowledgeBases(
    input.workspaceId,
    knowledgeBaseIds,
  );

  const revision = revisionFingerprint([
    ...knowledgeBaseIds,
    ...faqFacts,
    ...documentSourceIds.map((d) => d.id),
    ...openaiVectorStoreIds,
  ]);

  return {
    knowledgeBaseIds,
    openaiVectorStoreIds,
    documentSourceIds: documentSourceIds.map((d) => d.id),
    faqFacts,
    knowledgeItemSummaries,
    revision,
  };
}

/** Sync pending sources to OpenAI, then return compile slice for publish. */
export async function prepareKnowledgeForPublish(input: {
  workspaceId: string;
  agentId: string;
}): Promise<KnowledgeCompileSlice> {
  await processPendingKnowledgeSourcesForWorkspace(input.workspaceId);
  return buildKnowledgeCompileSlice(input);
}
