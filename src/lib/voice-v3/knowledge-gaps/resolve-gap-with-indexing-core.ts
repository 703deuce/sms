export type ResolveGapWithIndexingResult =
  | { ok: true; sourceId: string }
  | { ok: false; error: string; sourceId?: string };

export type ResolveGapIndexingDeps = {
  findKnowledgeBase: (workspaceId: string, knowledgeBaseId: string) => Promise<{ id: string } | null>;
  findGap: (workspaceId: string, gapId: string) => Promise<{ id: string; status: string } | null>;
  createPendingSource: (input: {
    workspaceId: string;
    knowledgeBaseId: string;
    name: string;
    contentText: string;
  }) => Promise<{ id: string }>;
  processKnowledgeSource: (sourceId: string) => Promise<void>;
  getSourceStatus: (sourceId: string) => Promise<{ status: string; errorMessage?: string | null } | null>;
  markGapResolved: (workspaceId: string, gapId: string) => Promise<void>;
};

/**
 * Testable orchestration: index before RESOLVED; failure leaves gap unresolved (caller must not mark RESOLVED).
 */
export async function resolveVoiceKnowledgeGapWithIndexingCore(
  input: {
    workspaceId: string;
    gapId: string;
    knowledgeBaseId: string;
    question: string;
    answerText: string;
  },
  deps: ResolveGapIndexingDeps,
): Promise<ResolveGapWithIndexingResult> {
  const kb = await deps.findKnowledgeBase(input.workspaceId, input.knowledgeBaseId);
  if (!kb) return { ok: false, error: "Knowledge base not found" };

  const gap = await deps.findGap(input.workspaceId, input.gapId);
  if (!gap) return { ok: false, error: "Knowledge gap not found" };

  const name = `FAQ: ${input.question.trim().slice(0, 80)}`;
  const content = `Q: ${input.question.trim()}\nA: ${input.answerText.trim()}`;

  const source = await deps.createPendingSource({
    workspaceId: input.workspaceId,
    knowledgeBaseId: kb.id,
    name,
    contentText: content,
  });

  try {
    await deps.processKnowledgeSource(source.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, sourceId: source.id };
  }

  const indexed = await deps.getSourceStatus(source.id);
  if (indexed?.status !== "indexed") {
    return {
      ok: false,
      error: indexed?.errorMessage || "Answer could not be prepared for search",
      sourceId: source.id,
    };
  }

  await deps.markGapResolved(input.workspaceId, input.gapId);
  return { ok: true, sourceId: source.id };
}
