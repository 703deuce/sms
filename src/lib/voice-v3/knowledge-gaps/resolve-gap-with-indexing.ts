import "server-only";

import { getPrisma } from "@/lib/db";
import { processKnowledgeSource } from "@/lib/voice/knowledge-processor";
import { updateVoiceKnowledgeGapStatus } from "./owner-service";
import {
  resolveVoiceKnowledgeGapWithIndexingCore,
  type ResolveGapWithIndexingResult,
} from "./resolve-gap-with-indexing-core";

export type { ResolveGapWithIndexingResult };

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
  return resolveVoiceKnowledgeGapWithIndexingCore(input, {
    findKnowledgeBase: async (workspaceId, knowledgeBaseId) =>
      prisma.voiceKnowledgeBase.findFirst({
        where: { id: knowledgeBaseId, workspaceId },
        select: { id: true },
      }),
    findGap: async (workspaceId, gapId) =>
      prisma.voiceKnowledgeGap.findFirst({
        where: { id: gapId, workspaceId },
        select: { id: true, status: true },
      }),
    createPendingSource: async ({ workspaceId, knowledgeBaseId, name, contentText }) => {
      const row = await prisma.voiceKnowledgeSource.create({
        data: {
          knowledgeBaseId,
          workspaceId,
          name,
          sourceType: "text",
          status: "pending",
          contentText,
        },
      });
      return { id: row.id };
    },
    processKnowledgeSource,
    getSourceStatus: async (sourceId) =>
      prisma.voiceKnowledgeSource.findUnique({
        where: { id: sourceId },
        select: { status: true, errorMessage: true },
      }),
    markGapResolved: async (workspaceId, gapId) => {
      await updateVoiceKnowledgeGapStatus({
        workspaceId,
        gapId,
        status: "RESOLVED",
      });
    },
  });
}
