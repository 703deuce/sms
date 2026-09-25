import "server-only";

import { getPrisma } from "@/lib/db";

export type VoiceKnowledgeGapRow = {
  id: string;
  displayQuestion: string;
  normalizedQuestion: string;
  status: string;
  timesAsked: number;
  firstAskedAt: string;
  lastAskedAt: string;
  recentWording: string | null;
  sourceCallIds: string[];
};

export async function listVoiceKnowledgeGaps(
  workspaceId: string,
  options?: { status?: string },
): Promise<VoiceKnowledgeGapRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.voiceKnowledgeGap.findMany({
    where: {
      workspaceId,
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: [{ status: "asc" }, { lastAskedAt: "desc" }],
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    displayQuestion: r.displayQuestion,
    normalizedQuestion: r.normalizedQuestion,
    status: r.status,
    timesAsked: r.timesAsked,
    firstAskedAt: r.firstAskedAt.toISOString(),
    lastAskedAt: r.lastAskedAt.toISOString(),
    recentWording: r.recentWording,
    sourceCallIds: Array.isArray(r.sourceCallIds)
      ? (r.sourceCallIds as string[]).map(String)
      : [],
  }));
}

export async function updateVoiceKnowledgeGapStatus(input: {
  workspaceId: string;
  gapId: string;
  status: "OPEN" | "DISMISSED" | "RESOLVED";
}): Promise<void> {
  const prisma = getPrisma();
  const updated = await prisma.voiceKnowledgeGap.updateMany({
    where: { id: input.gapId, workspaceId: input.workspaceId },
    data: { status: input.status },
  });
  if (updated.count === 0) {
    throw new Error("Knowledge gap not found");
  }
}

/** @deprecated Prefer resolveVoiceKnowledgeGapWithIndexing — creates source only, does not index. */
export async function appendApprovedAnswerToKnowledgeBase(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  question: string;
  answerText: string;
}): Promise<string> {
  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: input.knowledgeBaseId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!kb) throw new Error("Knowledge base not found");

  const name = `FAQ: ${input.question.trim().slice(0, 80)}`;
  const content = `Q: ${input.question.trim()}\nA: ${input.answerText.trim()}`;

  const source = await prisma.voiceKnowledgeSource.create({
    data: {
      knowledgeBaseId: kb.id,
      workspaceId: input.workspaceId,
      name,
      sourceType: "text",
      status: "pending",
      contentText: content,
    },
  });
  return source.id;
}
