import "server-only";

import type { VoiceV2AiCallRecoverySession } from "@prisma/client";
import type { VoiceV2SmsContinuationBundle } from "./continuation-hydration";
import { VOICE_V2_AI_CALL_RECOVERY_CONTINUATION_SOURCE } from "./types";
import type {
  VoiceV2RecoveryActionTimelineEntry,
  VoiceV2RecoveryStructuredState,
  VoiceV2RecoveryTranscriptTurn,
} from "./types";

/** Build authoritative continuation bundle from durable DB session (no process memory). */
export function buildVoiceV2SmsContinuationBundleFromSession(
  session: Pick<
    VoiceV2AiCallRecoverySession,
    | "id"
    | "voiceCallId"
    | "structuredState"
    | "voiceTranscriptTurns"
    | "actionTimeline"
    | "callSummary"
  >,
): VoiceV2SmsContinuationBundle {
  return {
    continuationSource: VOICE_V2_AI_CALL_RECOVERY_CONTINUATION_SOURCE,
    sourceVoiceCallId: session.voiceCallId,
    recoverySessionId: session.id,
    structuredState: session.structuredState as VoiceV2RecoveryStructuredState,
    voiceTranscript: (session.voiceTranscriptTurns || []) as VoiceV2RecoveryTranscriptTurn[],
    actionTimeline: (session.actionTimeline || []) as VoiceV2RecoveryActionTimelineEntry[],
    callSummary: session.callSummary,
  };
}
