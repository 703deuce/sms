/**
 * Versioned turn/generation isolation for realtime voice.
 * Stale generation callbacks must never produce audible output.
 */

export type TurnGenerationIds = {
  callId: string;
  turnId: number;
  generationId: string;
};

type CallGenerationState = {
  turnId: number;
  generationId: string;
  generationSeq: number;
  cancelled: boolean;
};

const byCall = new Map<string, CallGenerationState>();

function nextGenerationId(callId: string, turnId: number, seq: number): string {
  return `${callId}:t${turnId}:g${seq}`;
}

/** Start a new assistant generation for a call (new LLM response). */
export function startAssistantGeneration(callId: string, turnId?: number): TurnGenerationIds {
  const prev = byCall.get(callId);
  const resolvedTurn = turnId ?? (prev ? prev.turnId : 1);
  const seq = (prev?.generationSeq ?? 0) + 1;
  const generationId = nextGenerationId(callId, resolvedTurn, seq);
  byCall.set(callId, {
    turnId: resolvedTurn,
    generationId,
    generationSeq: seq,
    cancelled: false,
  });
  return { callId, turnId: resolvedTurn, generationId };
}

/** Caller resumed speaking — invalidate in-flight assistant generation. */
export function cancelActiveGeneration(callId: string, reason = "caller_interrupt"): string | null {
  const state = byCall.get(callId);
  if (!state || state.cancelled) return null;
  state.cancelled = true;
  if (process.env.VOICE_TTS_PIPELINE_DEBUG === "1") {
    console.log(
      JSON.stringify({
        source: "voice.generation_context",
        event: "generation_cancelled",
        callId,
        generationId: state.generationId,
        reason,
      }),
    );
  }
  return state.generationId;
}

/** Advance to a new caller turn. */
export function advanceCallerTurn(callId: string): number {
  const prev = byCall.get(callId);
  const turnId = (prev?.turnId ?? 0) + 1;
  byCall.set(callId, {
    turnId,
    generationId: nextGenerationId(callId, turnId, 0),
    generationSeq: 0,
    cancelled: false,
  });
  return turnId;
}

export function isGenerationActive(callId: string, generationId: string): boolean {
  const state = byCall.get(callId);
  if (!state) return false;
  return state.generationId === generationId && !state.cancelled;
}

export function getActiveGeneration(callId: string): TurnGenerationIds | null {
  const state = byCall.get(callId);
  if (!state) return null;
  return {
    callId,
    turnId: state.turnId,
    generationId: state.generationId,
  };
}

export function clearCallGenerationState(callId: string): void {
  byCall.delete(callId);
}
