import "server-only";

import { resolveVoiceV3DelegatedRuntimeContextForLiveKit } from "@/lib/server/voice-v3/livekit/live-context";
import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";

export async function resolveDelegatedRuntimeContext(input: {
  liveSessionId: string;
  delegationId?: string | null;
}) {
  const session = getLiveSession(input.liveSessionId);
  if (!session) return { liveContextEvents: [] };
  return resolveVoiceV3DelegatedRuntimeContextForLiveKit(input);
}

export async function commitCallerUtterance(input: {
  liveSessionId: string;
  utterance: string;
}) {
  const session = getLiveSession(input.liveSessionId);
  if (!session) {
    return { committed: false, code: "RUNTIME_NOT_FOUND" };
  }
  const { commitFinalCallerUtterance } = await import(
    "@/lib/server/voice-v3/conversation/caller-turn-manager"
  );
  const turn = commitFinalCallerUtterance(input.liveSessionId, input.utterance);
  if (!turn) {
    return { committed: false, code: "RUNTIME_NOT_FOUND" };
  }
  return {
    committed: true,
    sequence: turn.sequence,
    turnId: turn.turnId,
    utterance: input.utterance.trim(),
  };
}
