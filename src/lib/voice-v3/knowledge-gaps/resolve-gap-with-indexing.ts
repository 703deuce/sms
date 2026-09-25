import "server-only";

import { getPrisma } from "@/lib/db";
import { processKnowledgeSource } from "@/lib/voice/knowledge-processor";
import { updateVoiceKnowledgeGapStatus } from "./owner-service";

export type ResolveGapWithIndexingResult =
  | { ok: true; sourceId: string }
  | { ok: false; error: string; sourceId?: string };

/**
 * Create FAQ source, process through existing indexer, mark gap RESOLVED only on indexed success.
 */
export async function resolveVoiceKnowledgeGapWithIndexing(input: {
  workspaceId: string;
  gapId: string;
  knowledgeBaseId: string;
  question: string;
  answerText: string;
}): Promise<ResolveGapWithIndexingResult> {
  const prisma = getPrisma();
  const kb = await prisma.voiceKnowledgeBase.findFirst({
    where: { id: input.knowledgeBaseId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!kb) return { ok: false, error: "Knowledge base not found" };

  const gap = await prisma.voiceKnowledgeGap.findFirst({
    where: { id: input.gapId, workspaceId: input.workspaceId },
    select: { id: true, status: true },
  });
  if (!gap) return { ok: false, error: "Knowledge gap not found" };

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

  try {
    await processKnowledgeSource(source.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, sourceId: source.id };
  }

  const indexed = await prisma.voiceKnowledgeSource.findUnique({
    where: { id: source.id },
    select: { status: true, errorMessage: true },
  });
  if (indexed?.status !== "indexed") {
    return {
      ok: false,
      error: indexed?.errorMessage || "Answer could not be prepared for search",
      sourceId: source.id,
    };
  }

  await updateVoiceKnowledgeGapStatus({
    workspaceId: input.workspaceId,
    gapId: input.gapId,
    status: "RESOLVED",
  });

  return { ok: true, sourceId: source.id };
}
