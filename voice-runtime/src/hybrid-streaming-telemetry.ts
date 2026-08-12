/**
 * Per-turn telemetry for Realtime text → ElevenLabs hybrid streaming.
 * Wired from latency instrumentation and the hybrid tts_node hook.
 */
export type HybridStreamingTurnTelemetry = {
  turn: number;
  callId?: string;
  speechAnchorMs?: number;
  llmFirstTextDeltaMs?: number;
  ttsFirstTextSentMs?: number;
  elevenlabsTtfbMs?: number;
  firstAudioMs?: number;
  llmFirstTextLogged?: boolean;
  ttsFirstTextLogged?: boolean;
  elevenlabsTtfbLogged?: boolean;
  firstAudioLogged?: boolean;
};

let activeTurn: HybridStreamingTurnTelemetry | null = null;

function logHybridEvent(event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event,
      ts: Date.now(),
      ...payload,
    }),
  );
}

export function resetHybridStreamingTurn(input: {
  turn: number;
  callId?: string;
  speechAnchorMs?: number;
}): void {
  activeTurn = {
    turn: input.turn,
    callId: input.callId,
    speechAnchorMs: input.speechAnchorMs,
  };
}

export function getHybridStreamingTurn(): HybridStreamingTurnTelemetry | null {
  return activeTurn;
}

function anchorMs(): number | undefined {
  return activeTurn?.speechAnchorMs;
}

function latencyFromAnchor(now = Date.now()): number | undefined {
  const anchor = anchorMs();
  return anchor != null ? now - anchor : undefined;
}

export function markHybridLlmFirstTextDelta(textPreview?: string): void {
  if (!activeTurn || activeTurn.llmFirstTextLogged) return;
  activeTurn.llmFirstTextLogged = true;
  activeTurn.llmFirstTextDeltaMs = latencyFromAnchor();
  logHybridEvent("llm_first_text_delta_ms", {
    turn: activeTurn.turn,
    callId: activeTurn.callId,
    llmFirstTextDeltaMs: activeTurn.llmFirstTextDeltaMs,
    textPreview: textPreview?.slice(0, 48) ?? null,
  });
}

export function markHybridTtsFirstTextSent(textPreview?: string): void {
  if (!activeTurn || activeTurn.ttsFirstTextLogged) return;
  activeTurn.ttsFirstTextLogged = true;
  activeTurn.ttsFirstTextSentMs = latencyFromAnchor();
  logHybridEvent("tts_first_text_sent_ms", {
    turn: activeTurn.turn,
    callId: activeTurn.callId,
    ttsFirstTextSentMs: activeTurn.ttsFirstTextSentMs,
    textPreview: textPreview?.slice(0, 48) ?? null,
  });
}

export function markHybridElevenLabsTtfb(ttfbMs: number): void {
  if (!activeTurn || activeTurn.elevenlabsTtfbLogged) return;
  activeTurn.elevenlabsTtfbLogged = true;
  activeTurn.elevenlabsTtfbMs = ttfbMs;
  logHybridEvent("elevenlabs_ttfb_ms", {
    turn: activeTurn.turn,
    callId: activeTurn.callId,
    elevenlabsTtfbMs: ttfbMs,
    ttsFirstTextSentMs: activeTurn.ttsFirstTextSentMs ?? null,
    llmFirstTextDeltaMs: activeTurn.llmFirstTextDeltaMs ?? null,
  });
}

export function markHybridFirstAudio(now = Date.now()): void {
  if (!activeTurn || activeTurn.firstAudioLogged) return;
  activeTurn.firstAudioLogged = true;
  activeTurn.firstAudioMs = latencyFromAnchor(now);
  logHybridEvent("first_audio_ms", {
    turn: activeTurn.turn,
    callId: activeTurn.callId,
    firstAudioMs: activeTurn.firstAudioMs,
    llmFirstTextDeltaMs: activeTurn.llmFirstTextDeltaMs ?? null,
    ttsFirstTextSentMs: activeTurn.ttsFirstTextSentMs ?? null,
    elevenlabsTtfbMs: activeTurn.elevenlabsTtfbMs ?? null,
  });
}
