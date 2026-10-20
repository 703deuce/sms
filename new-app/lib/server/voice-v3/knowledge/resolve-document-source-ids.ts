import "server-only";

import { getPrisma } from "@/lib/server/db";

/** Active indexed document sources for linked knowledge bases (RAG retrieval). */
export async function resolveDocumentSourceIdsForKnowledgeBases(
  workspaceId: string,
  knowledgeBaseIds: string[],
): Promise<string[]> {
  const kbIds = [...new Set(knowledgeBaseIds.map((id) => id.trim()).filter(Boolean))];
  if (!kbIds.length) return [];

  const prisma = getPrisma();
  const rows = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId,
      knowledgeBaseId: { in: kbIds },
      status: { in: ["indexed", "ready", "processing", "pending"] },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((r) => r.id);
}
