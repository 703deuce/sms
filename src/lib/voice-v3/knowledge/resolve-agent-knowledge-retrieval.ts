import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  computeKnowledgeRevisionFingerprint,
  knowledgeConfigFromWizard,
} from "@/lib/voice-receptionist-wizard/knowledge-config";
import {
  listOpenAiVectorStoreIdsForKnowledgeBases,
  useGptLiveFileSearchRag,
} from "@/lib/voice/gpt-live-file-search-rag";
import { resolveDocumentSourceIdsForKnowledgeBases } from "./resolve-document-source-ids";

export type ResolvedAgentKnowledgeRetrieval = {
  knowledgeBaseIds: string[];
  documentSourceIds: string[];
  /** OpenAI vector store ids for LiveKit GPT Live `FileSearch` provider tool. */
  openaiVectorStoreIds: string[];
  enabled: boolean;
  revision: string;
  websiteUrl: string | null;
};

async function knowledgeBaseIdsForAgent(input: {
  workspaceId: string;
  agentId: string;
  wizard: AppointmentReceptionistWizardState;
}): Promise<string[]> {
  const prisma = getPrisma();
  const ids = new Set<string>();

  const linked = input.wizard.linkedKnowledgeBaseId?.trim();
  if (linked) ids.add(linked);

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  const draft = (agent?.draftConfig || {}) as Record<string, unknown>;
  if (Array.isArray(draft.knowledgeBaseIds)) {
    for (const id of draft.knowledgeBaseIds) {
      if (id) ids.add(String(id));
    }
  }

  const links = await prisma.voiceAgentKnowledgeBase.findMany({
    where: { workspaceId: input.workspaceId, agentId: input.agentId },
    select: { knowledgeBaseId: true },
  });
  for (const row of links) {
    if (row.knowledgeBaseId) ids.add(row.knowledgeBaseId);
  }

  const verified: string[] = [];
  for (const id of ids) {
    const kb = await prisma.voiceKnowledgeBase.findFirst({
      where: { id, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (kb) verified.push(kb.id);
  }
  return verified;
}

async function hasIndexedKnowledgeSources(
  workspaceId: string,
  knowledgeBaseIds: string[],
): Promise<boolean> {
  if (!knowledgeBaseIds.length) return false;
  const prisma = getPrisma();
  const count = await prisma.voiceKnowledgeSource.count({
    where: {
      workspaceId,
      knowledgeBaseId: { in: knowledgeBaseIds },
      status: "indexed",
    },
  });
  return count > 0;
}

/**
 * Authoritative retrieval config for Voice V3 LiveKit calls — wizard + agent KB links + indexed sources.
 */
export async function resolveAgentKnowledgeRetrieval(input: {
  workspaceId: string;
  agentId: string;
  wizard: AppointmentReceptionistWizardState;
}): Promise<ResolvedAgentKnowledgeRetrieval> {
  const knowledgeBaseIds = await knowledgeBaseIdsForAgent(input);
  const kbConfig = knowledgeConfigFromWizard(input.wizard, knowledgeBaseIds);
  const documentSourceIds = await resolveDocumentSourceIdsForKnowledgeBases(
    input.workspaceId,
    knowledgeBaseIds,
  );

  const indexed = await hasIndexedKnowledgeSources(input.workspaceId, knowledgeBaseIds);
  const openaiVectorStoreIds = await listOpenAiVectorStoreIdsForKnowledgeBases(
    input.workspaceId,
    knowledgeBaseIds,
  );
  const wizardAllows =
    input.wizard.knowledgeBaseEnabled !== false &&
    (kbConfig.knowledgeBaseEnabled || indexed || knowledgeBaseIds.length > 0);

  const hasRetrievalIndex = useGptLiveFileSearchRag()
    ? openaiVectorStoreIds.length > 0 && indexed
    : indexed || documentSourceIds.length > 0;

  const enabled =
    wizardAllows && knowledgeBaseIds.length > 0 && hasRetrievalIndex;

  const revision =
    input.wizard.knowledgeBaseRevision?.trim() ||
    computeKnowledgeRevisionFingerprint(input.wizard, knowledgeBaseIds);

  return {
    knowledgeBaseIds,
    documentSourceIds,
    openaiVectorStoreIds,
    enabled,
    revision,
    websiteUrl: input.wizard.websiteUrl?.trim() || null,
  };
}
