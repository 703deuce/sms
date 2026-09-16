import "server-only";

import type { MctbConversationTurn } from "@/lib/mctb/conversation-thread";
import { buildVoiceV2SmsContinuationBundleFromSession } from "./durable-continuation";
import { findRecoverySessionForSmsContinuation } from "./session-store";
import type { VoiceV2RecoveryStructuredState, VoiceV2RecoveryTranscriptTurn } from "./types";
import { VOICE_V2_AI_CALL_RECOVERY_CONTINUATION_SOURCE } from "./types";

export type VoiceV2SmsContinuationBundle = {
  continuationSource: typeof VOICE_V2_AI_CALL_RECOVERY_CONTINUATION_SOURCE;
  sourceVoiceCallId: string;
  recoverySessionId: string;
  structuredState: VoiceV2RecoveryStructuredState;
  voiceTranscript: VoiceV2RecoveryTranscriptTurn[];
  actionTimeline: Array<{ kind: string; summary: string }>;
  callSummary?: string | null;
};

const continuationByConversation = new Map<string, VoiceV2SmsContinuationBundle>();

/** L1 cache only — not authoritative. */
export function registerVoiceV2SmsContinuation(
  conversationId: string,
  bundle: VoiceV2SmsContinuationBundle,
): void {
  continuationByConversation.set(conversationId, bundle);
}

export function getVoiceV2SmsContinuation(
  conversationId: string,
): VoiceV2SmsContinuationBundle | null {
  return continuationByConversation.get(conversationId) ?? null;
}

/** Test helper — simulate cold replica with no L1 cache. */
export function clearVoiceV2SmsContinuationCache(): void {
  continuationByConversation.clear();
}

/**
 * Authoritative continuation resolve: durable VoiceV2AiCallRecoverySession first,
 * then optional L1 cache populate.
 */
export async function resolveVoiceV2SmsContinuation(input: {
  workspaceId: string;
  conversationId: string;
  callerE164?: string;
  sendingE164?: string;
}): Promise<VoiceV2SmsContinuationBundle | null> {
  const session = await findRecoverySessionForSmsContinuation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    callerE164: input.callerE164?.trim() || "",
    sendingE164: input.sendingE164?.trim() || "",
  });
  if (session) {
    const bundle = buildVoiceV2SmsContinuationBundleFromSession(session);
    registerVoiceV2SmsContinuation(input.conversationId, bundle);
    return bundle;
  }
  return getVoiceV2SmsContinuation(input.conversationId);
}

/** Merge voice transcript + SMS thread for the existing text agent context builder. */
export function mergeVoiceContinuationIntoConversationTurns(input: {
  voiceTurns: VoiceV2RecoveryTranscriptTurn[];
  smsTurns: MctbConversationTurn[];
}): MctbConversationTurn[] {
  const voiceMapped: MctbConversationTurn[] = input.voiceTurns.map((t) => ({
    role: t.role === "caller" ? "customer" : "business",
    text: t.text,
  }));
  return [...voiceMapped, ...input.smsTurns];
}
