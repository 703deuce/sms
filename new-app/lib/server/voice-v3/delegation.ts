import "server-only";

import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";

export async function resolveDelegatedRuntimeContext(input: {
  liveSessionId: string;
  delegationId?: string | null;
}) {
  const session = getLiveSession(input.liveSessionId);
  if (!session) return { liveContextEvents: [] };
  return {
    liveContextEvents: [
      {
        type: "intake_snapshot",
        intake: session.intake,
        scheduling: session.scheduling,
      },
    ],
  };
}

export async function commitCallerUtterance(input: {
  liveSessionId: string;
  utterance: string;
}) {
  const session = getLiveSession(input.liveSessionId);
  if (!session) {
    return { committed: false, code: "RUNTIME_NOT_FOUND" };
  }
  return {
    committed: true,
    sequence: Date.now(),
    turnId: `turn_${session.liveSessionId}_${Date.now()}`,
    utterance: input.utterance.trim(),
  };
}
