import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import type { KnowledgeCompileSlice } from "@/lib/server/voice-v3/editor-to-voice-v3-config";

/** Business knowledge profile boxes on the Knowledge page (draft editor state). */
export function editorHasKnowledgeProfileContent(editor: AgentConfig): boolean {
  const kp = editor.knowledgeProfile;
  if (!kp) return false;
  return [
    kp.businessOverview,
    kp.pricing,
    kp.paymentMethods,
    kp.policies,
    kp.agentJob,
  ].some((value) => Boolean(value?.trim()));
}

/** Linked KB sources with usable text (FAQs, files, crawled pages — not only sourceType faq). */
export async function linkedKnowledgeBasesHaveTextContent(
  workspaceId: string,
  knowledgeBaseIds: string[],
): Promise<boolean> {
  if (!knowledgeBaseIds.length) return false;
  const prisma = getPrisma();
  const source = await prisma.voiceKnowledgeSource.findFirst({
    where: {
      workspaceId,
      knowledgeBaseId: { in: knowledgeBaseIds },
      status: { in: ["ready", "indexed", "published"] },
      contentText: { not: "" },
    },
    select: { id: true, contentText: true },
  });
  return Boolean(source?.contentText?.trim());
}

export function compileSliceHasAnswerKnowledge(slice: KnowledgeCompileSlice): boolean {
  if (slice.faqFacts.length > 0) return true;
  if (slice.openaiVectorStoreIds.length > 0) return true;
  if (slice.documentSourceIds.length > 0) return true;
  return false;
}

export async function receptionistHasPublishableAnswerKnowledge(
  workspaceId: string,
  editor: AgentConfig,
  slice: KnowledgeCompileSlice,
): Promise<boolean> {
  if (editorHasKnowledgeProfileContent(editor)) return true;
  if (compileSliceHasAnswerKnowledge(slice)) return true;
  return linkedKnowledgeBasesHaveTextContent(workspaceId, slice.knowledgeBaseIds);
}
