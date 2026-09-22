import "server-only";

import { getPrisma } from "@/lib/db";
import { emitVoiceV3PostCallWebhooks } from "./emit-post-call-webhooks";
import {
  loadKnowledgeGapCandidatesForCall,
  persistKnowledgeGapCandidates,
} from "./knowledge-gaps";

export async function runVoiceV3PostCallSideEffects(input: {
  callId: string;
  workspaceId: string;
  summaryText: string;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!call) return;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const postCall = (meta.voiceV3PostCall || {}) as Record<string, unknown>;

  if (!postCall.webhooksEmittedAt) {
    try {
      await emitVoiceV3PostCallWebhooks({
        callId: input.callId,
        workspaceId: input.workspaceId,
        summaryText: input.summaryText,
      });
      postCall.webhooksEmittedAt = new Date().toISOString();
    } catch (err) {
      console.error("VOICE_V3_POST_CALL_WEBHOOKS_FAILED", {
        callId: input.callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!postCall.knowledgeGapsPersistedAt) {
    try {
      const candidates = await loadKnowledgeGapCandidatesForCall(
        input.callId,
        input.workspaceId,
      );
      if (candidates.length) {
        await persistKnowledgeGapCandidates({
          workspaceId: input.workspaceId,
          callId: input.callId,
          candidates,
        });
      }
      postCall.knowledgeGapsPersistedAt = new Date().toISOString();
    } catch (err) {
      console.error("VOICE_V3_KNOWLEDGE_GAPS_FAILED", {
        callId: input.callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...meta,
        voiceV3PostCall: postCall,
      } as object,
    },
  });
}
