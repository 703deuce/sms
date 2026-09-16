import "server-only";

import type { MctbConversationTurn } from "@/lib/mctb/conversation-thread";
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
