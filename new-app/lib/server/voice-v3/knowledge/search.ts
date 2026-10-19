import "server-only";

import { getPrisma } from "@/lib/server/db";

export async function searchBusinessKnowledge(input: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<{ matches: { question: string; answer: string; sourceId: string }[] }> {
  const q = input.query.trim().toLowerCase();
  if (!q) return { matches: [] };

  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { workspaceId, status: "active" },
  });
  if (!kb) return { matches: [] };

  const sources = await prisma.voiceKnowledgeSource.findMany({
    where: {
      workspaceId,
      knowledgeBaseId: kb.id,
      sourceType: "faq",
      status: { in: ["ready", "published"] },
    },
    take: 200,
  });

  const scored = sources
    .map((s) => {
      const meta = (s.fileMeta || {}) as { question?: string };
      const question = (meta.question || s.name || "").toLowerCase();
      const answer = (s.contentText || "").toLowerCase();
      let score = 0;
      if (question.includes(q)) score += 3;
      if (answer.includes(q)) score += 2;
      for (const word of q.split(/\s+/)) {
        if (word.length < 3) continue;
        if (question.includes(word)) score += 1;
        if (answer.includes(word)) score += 1;
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 3);

  return {
    matches: scored.map(({ s }) => ({
      question: s.name,
      answer: s.contentText || "",
      sourceId: s.id,
    })),
  };
}
