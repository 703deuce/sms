import "server-only";

import { getPrisma } from "@/lib/db";

function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function mergeCallIds(existing: unknown, callId: string): string[] {
  const base = Array.isArray(existing) ? existing.map(String) : [];
  if (!base.includes(callId)) base.push(callId);
  return base.slice(-50);
}

export type VoiceV3KnowledgeGapCandidate = {
  question: string;
  normalizedQuestion: string;
  unanswered: boolean;
  context?: string;
};

export async function persistKnowledgeGapCandidates(input: {
  workspaceId: string;
  callId: string;
  candidates: VoiceV3KnowledgeGapCandidate[];
}): Promise<void> {
  if (!input.candidates.length) return;
  const prisma = getPrisma();

  for (const c of input.candidates) {
    if (!c.unanswered) continue;
    const normalized = normalizeQuestion(c.normalizedQuestion || c.question);
    if (!normalized || normalized.length < 8) continue;

    const existing = await prisma.voiceKnowledgeGap.findUnique({
      where: {
        workspaceId_normalizedQuestion: {
          workspaceId: input.workspaceId,
          normalizedQuestion: normalized,
        },
      },
    });

    if (existing) {
      await prisma.voiceKnowledgeGap.update({
        where: { id: existing.id },
        data: {
          timesAsked: { increment: 1 },
          lastAskedAt: new Date(),
          displayQuestion: c.question.trim(),
          recentWording: c.context?.slice(0, 500) || undefined,
          sourceCallIds: mergeCallIds(existing.sourceCallIds, input.callId),
        },
      });
    } else {
      await prisma.voiceKnowledgeGap.create({
        data: {
          workspaceId: input.workspaceId,
          normalizedQuestion: normalized,
          displayQuestion: c.question.trim(),
          timesAsked: 1,
          status: "OPEN",
          firstAskedAt: new Date(),
          lastAskedAt: new Date(),
          sourceCallIds: [input.callId],
          recentWording: c.context?.slice(0, 500) || null,
        },
      });
    }
  }
}

export async function loadKnowledgeGapCandidatesForCall(
  callId: string,
  workspaceId: string,
): Promise<VoiceV3KnowledgeGapCandidate[]> {
  const prisma = getPrisma();
  const insight = await prisma.voiceConversationInsight.findFirst({
    where: { callId, workspaceId },
    orderBy: { createdAt: "desc" },
    select: { customFields: true },
  });
  const custom = (insight?.customFields || {}) as Record<string, unknown>;
  const raw = custom.voiceV3KnowledgeGapCandidates;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is VoiceV3KnowledgeGapCandidate =>
      c &&
      typeof c === "object" &&
      typeof (c as VoiceV3KnowledgeGapCandidate).question === "string",
  );
}
