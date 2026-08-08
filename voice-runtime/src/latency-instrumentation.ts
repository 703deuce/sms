import {
  AgentSessionEventTypes,
  type AgentMetrics,
  type FunctionToolsExecutedEvent,
  type MetricsCollectedEvent,
  type UserInputTranscribedEvent,
  type UserStateChangedEvent,
  voice,
} from "@livekit/agents";

export type TurnLatencySnapshot = {
  callId?: string;
  turn: number;
  userSpeechEndMs?: number;
  sttFinalMs?: number;
  llmFirstTokenMs?: number;
  ttsFirstAudioMs?: number;
  toolMs?: number;
  speechEndToFirstAudioMs?: number;
};

type TurnState = {
  turn: number;
  userSpeechEndMs?: number;
  sttFinalMs?: number;
  llmFirstTokenMs?: number;
  ttsFirstAudioMs?: number;
  toolMs?: number;
};

function logLatency(event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event,
      ts: Date.now(),
      ...payload,
    }),
  );
}

function snapshotTurn(state: TurnState, callId?: string): TurnLatencySnapshot {
  const speechEndToFirstAudioMs =
    state.userSpeechEndMs != null && state.ttsFirstAudioMs != null
      ? state.ttsFirstAudioMs - state.userSpeechEndMs
      : undefined;

  return {
    callId,
    turn: state.turn,
    userSpeechEndMs: state.userSpeechEndMs,
    sttFinalMs: state.sttFinalMs,
    llmFirstTokenMs: state.llmFirstTokenMs,
    ttsFirstAudioMs: state.ttsFirstAudioMs,
    toolMs: state.toolMs,
    speechEndToFirstAudioMs,
  };
}

function recordMetrics(metrics: AgentMetrics, state: TurnState) {
  const now = Date.now();
  if (metrics.type === "eou_metrics") {
    if (metrics.lastSpeakingTimeMs > 0) {
      state.userSpeechEndMs = metrics.lastSpeakingTimeMs;
    }
    logLatency("eou_metrics", {
      turn: state.turn,
      endOfUtteranceDelayMs: metrics.endOfUtteranceDelayMs,
      transcriptionDelayMs: metrics.transcriptionDelayMs,
      lastSpeakingTimeMs: metrics.lastSpeakingTimeMs,
    });
  }

  if (metrics.type === "stt_metrics") {
    state.sttFinalMs = now;
    logLatency("stt_final", {
      turn: state.turn,
      durationMs: metrics.durationMs,
      audioDurationMs: metrics.audioDurationMs,
      streamed: metrics.streamed,
      provider: metrics.metadata?.modelProvider,
      model: metrics.metadata?.modelName,
    });
  }

  if (metrics.type === "llm_metrics") {
    state.llmFirstTokenMs = now;
    logLatency("llm_first_token", {
      turn: state.turn,
      ttftMs: metrics.ttftMs,
      durationMs: metrics.durationMs,
      provider: metrics.metadata?.modelProvider,
      model: metrics.metadata?.modelName,
    });
  }

  if (metrics.type === "tts_metrics") {
    state.ttsFirstAudioMs = now;
    logLatency("tts_first_audio", {
      turn: state.turn,
      ttfbMs: metrics.ttfbMs,
      durationMs: metrics.durationMs,
      provider: metrics.metadata?.modelProvider,
      model: metrics.metadata?.modelName,
    });
    logLatency("turn_latency_summary", snapshotTurn(state));
  }
}

export function attachLatencyInstrumentation(
  session: voice.AgentSession,
  input?: { callId?: string },
) {
  const callId = input?.callId;
  const state: TurnState = { turn: 0 };

  session.on(
    AgentSessionEventTypes.UserStateChanged,
    (ev: UserStateChangedEvent) => {
      if (ev.oldState === "speaking" && ev.newState === "listening") {
        state.turn += 1;
        state.userSpeechEndMs = Date.now();
        state.sttFinalMs = undefined;
        state.llmFirstTokenMs = undefined;
        state.ttsFirstAudioMs = undefined;
        state.toolMs = undefined;
        logLatency("user_speech_end", { turn: state.turn, callId });
      }
    },
  );

  session.on(
    AgentSessionEventTypes.UserInputTranscribed,
    (ev: UserInputTranscribedEvent) => {
      if (!ev.isFinal) return;
      state.sttFinalMs = Date.now();
      logLatency("stt_transcript_final", {
        turn: state.turn,
        callId,
        transcript: ev.transcript,
        language: ev.language,
        latencyMs:
          state.userSpeechEndMs != null
            ? state.sttFinalMs - state.userSpeechEndMs
            : undefined,
      });
    },
  );

  session.on(
    AgentSessionEventTypes.MetricsCollected,
    (ev: MetricsCollectedEvent) => {
      recordMetrics(ev.metrics, state);
    },
  );

  session.on(
    AgentSessionEventTypes.FunctionToolsExecuted,
    (ev: FunctionToolsExecutedEvent) => {
      const started = ev.createdAt || Date.now();
      const finished = Date.now();
      state.toolMs = finished - started;
      logLatency("tool_executed", {
        turn: state.turn,
        callId,
        toolMs: state.toolMs,
        tools: ev.functionCalls.map((call) => call.name),
      });
    },
  );
}
