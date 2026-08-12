import {
  AgentSessionEventTypes,
  type AgentMetrics,
  type AgentStateChangedEvent,
  type FunctionToolsExecutedEvent,
  type MetricsCollectedEvent,
  type UserInputTranscribedEvent,
  type UserStateChangedEvent,
  voice,
} from "@livekit/agents";
import { markFirstAudioStarted } from "./task-transition-instrumentation";
import {
  markHybridElevenLabsTtfb,
  markHybridFirstAudio,
  resetHybridStreamingTurn,
} from "./hybrid-streaming-telemetry";
import type { FrontDeskUserData } from "./frontdesk/userdata";

export type LatencyPipelineKind = "stack" | "realtime_native" | "realtime_elevenlabs";

export type TurnLatencyBreakdown = {
  callId?: string;
  turn: number;
  transcript?: string;
  hadToolCall: boolean;
  preemptiveObserved: boolean;
  ttsConfig?: {
    preset?: string | null;
    provider?: string;
    model?: string;
    voice?: string;
  };
  components: {
    transcriptionDelayMs?: number;
    endOfUtteranceDelayMs?: number;
    onUserTurnCompletedDelayMs?: number;
    sttFinalAfterSpeechEndMs?: number;
    llmTtftMs?: number;
    ttsTtfbMs?: number;
    playbackEstimateMs?: number;
    e2eFirstAudioMs?: number;
    toolMs?: number;
  };
  flags: {
    ordinaryTurnOver2s: boolean;
    toolOver3s: boolean;
    preemptiveTtsConfigured: boolean;
  };
  preemptiveConfig: {
    enabled: boolean;
    preemptiveTts: boolean;
  };
};

type TurnState = {
  turn: number;
  userSpeechEndMs?: number;
  userSpeechStartMs?: number;
  agentWasSpeakingAtSpeechStart?: boolean;
  sttFinalMs?: number;
  sttTranscript?: string;
  preemptiveObserved: boolean;
  suspectedFalseInterruptionCount: number;
  eou?: {
    transcriptionDelayMs: number;
    endOfUtteranceDelayMs: number;
    onUserTurnCompletedDelayMs: number;
    lastSpeakingTimeMs: number;
  };
  llmTtftMs?: number;
  ttsTtfbMs?: number;
  ttsFirstAudioMs?: number;
  agentSpeakingMs?: number;
  toolMs?: number;
  hadToolCall: boolean;
  breakdownEmitted: boolean;
};

function maybeMarkTaskFirstAudio(session: voice.AgentSession<any>): void {
  const ud = session.userData as FrontDeskUserData | undefined;
  const inst = ud?.activeTaskInstrumentation;
  if (!ud?.callId || !inst || inst.firstAudioLogged) return;
  inst.firstAudioLogged = true;
  markFirstAudioStarted({
    callId: ud.callId,
    taskId: inst.taskId,
    taskType: inst.taskType,
  });
}

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

function roundMs(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.round(value);
}

function buildBreakdown(
  state: TurnState,
  input: {
    callId?: string;
    preemptiveConfig: TurnLatencyBreakdown["preemptiveConfig"];
    ttsConfig?: TurnLatencyBreakdown["ttsConfig"];
  },
): TurnLatencyBreakdown {
  const speechAnchor =
    state.eou?.lastSpeakingTimeMs && state.eou.lastSpeakingTimeMs > 0
      ? state.eou.lastSpeakingTimeMs
      : state.userSpeechEndMs;

  const e2eFirstAudioMs =
    speechAnchor != null && state.ttsFirstAudioMs != null
      ? state.ttsFirstAudioMs - speechAnchor
      : undefined;

  const accounted =
    (state.eou?.transcriptionDelayMs ?? 0) +
    (state.eou?.endOfUtteranceDelayMs ?? 0) +
    (state.eou?.onUserTurnCompletedDelayMs ?? 0) +
    (state.llmTtftMs ?? 0) +
    (state.ttsTtfbMs ?? 0);

  const playbackEstimateMs =
    e2eFirstAudioMs != null ? Math.max(0, e2eFirstAudioMs - accounted) : undefined;

  const components = {
    transcriptionDelayMs: roundMs(state.eou?.transcriptionDelayMs),
    endOfUtteranceDelayMs: roundMs(state.eou?.endOfUtteranceDelayMs),
    onUserTurnCompletedDelayMs: roundMs(state.eou?.onUserTurnCompletedDelayMs),
    sttFinalAfterSpeechEndMs:
      speechAnchor != null && state.sttFinalMs != null
        ? roundMs(state.sttFinalMs - speechAnchor)
        : undefined,
    llmTtftMs: roundMs(state.llmTtftMs),
    ttsTtfbMs: roundMs(state.ttsTtfbMs),
    playbackEstimateMs: roundMs(playbackEstimateMs),
    e2eFirstAudioMs: roundMs(e2eFirstAudioMs),
    toolMs: roundMs(state.toolMs),
  };

  const ordinary = !state.hadToolCall;
  const e2e = components.e2eFirstAudioMs ?? 0;

  return {
    callId: input.callId,
    turn: state.turn,
    transcript: state.sttTranscript,
    hadToolCall: state.hadToolCall,
    preemptiveObserved: state.preemptiveObserved,
    ttsConfig: input.ttsConfig,
    components,
    flags: {
      ordinaryTurnOver2s: ordinary && e2e > 2000,
      toolOver3s: state.hadToolCall && (state.toolMs ?? 0) > 3000,
      preemptiveTtsConfigured: input.preemptiveConfig.preemptiveTts,
    },
    preemptiveConfig: input.preemptiveConfig,
  };
}

function emitTurnBreakdown(
  state: TurnState,
  input: {
    callId?: string;
    preemptiveConfig: TurnLatencyBreakdown["preemptiveConfig"];
    ttsConfig?: TurnLatencyBreakdown["ttsConfig"];
  },
) {
  if (state.breakdownEmitted) return;
  state.breakdownEmitted = true;
  const breakdown = buildBreakdown(state, input);
  logLatency("turn_latency_breakdown", breakdown);

  if (breakdown.flags.ordinaryTurnOver2s) {
    logLatency("turn_latency_alert", {
      turn: breakdown.turn,
      callId: breakdown.callId,
      reason: "ordinary_turn_over_2s",
      e2eFirstAudioMs: breakdown.components.e2eFirstAudioMs,
      components: breakdown.components,
    });
  }
  if (breakdown.flags.toolOver3s) {
    logLatency("turn_latency_alert", {
      turn: breakdown.turn,
      callId: breakdown.callId,
      reason: "tool_over_3s",
      toolMs: breakdown.components.toolMs,
      tools: "see tool_executed",
    });
  }
}

function recordMetrics(
  metrics: AgentMetrics,
  state: TurnState,
  input: {
    callId?: string;
    pipelineKind: LatencyPipelineKind;
    preemptiveConfig: TurnLatencyBreakdown["preemptiveConfig"];
    ttsConfig?: TurnLatencyBreakdown["ttsConfig"];
  },
) {
  const now = Date.now();

  logLatency("livekit_metrics", {
    turn: state.turn,
    callId: input.callId,
    metricType: metrics.type,
    ttftMs: "ttftMs" in metrics ? metrics.ttftMs : undefined,
    ttfbMs: "ttfbMs" in metrics ? metrics.ttfbMs : undefined,
    durationMs: "durationMs" in metrics ? metrics.durationMs : undefined,
    speechId: "speechId" in metrics ? metrics.speechId : undefined,
    provider: "metadata" in metrics ? metrics.metadata?.modelProvider : undefined,
    model: "metadata" in metrics ? metrics.metadata?.modelName : undefined,
  });

  if (metrics.type === "eou_metrics") {
    state.eou = {
      transcriptionDelayMs: metrics.transcriptionDelayMs,
      endOfUtteranceDelayMs: metrics.endOfUtteranceDelayMs,
      onUserTurnCompletedDelayMs: metrics.onUserTurnCompletedDelayMs,
      lastSpeakingTimeMs: metrics.lastSpeakingTimeMs,
    };
    if (metrics.lastSpeakingTimeMs > 0) {
      state.userSpeechEndMs = metrics.lastSpeakingTimeMs;
      if (input.pipelineKind === "realtime_elevenlabs") {
        resetHybridStreamingTurn({
          turn: state.turn,
          callId: input.callId,
          speechAnchorMs: metrics.lastSpeakingTimeMs,
        });
      }
    }
    logLatency("eou_metrics", {
      turn: state.turn,
      endOfUtteranceDelayMs: metrics.endOfUtteranceDelayMs,
      transcriptionDelayMs: metrics.transcriptionDelayMs,
      onUserTurnCompletedDelayMs: metrics.onUserTurnCompletedDelayMs,
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
    state.llmTtftMs = metrics.ttftMs;
    logLatency("llm_first_token", {
      turn: state.turn,
      ttftMs: metrics.ttftMs,
      durationMs: metrics.durationMs,
      provider: metrics.metadata?.modelProvider,
      model: metrics.metadata?.modelName,
      speechId: metrics.speechId,
    });
  }

  if (metrics.type === "tts_metrics") {
    state.ttsTtfbMs = metrics.ttfbMs;
    state.ttsFirstAudioMs = now;
    if (input.pipelineKind === "realtime_elevenlabs") {
      markHybridElevenLabsTtfb(metrics.ttfbMs);
      markHybridFirstAudio(now);
    }
    logLatency("tts_first_audio", {
      turn: state.turn,
      ttfbMs: metrics.ttfbMs,
      durationMs: metrics.durationMs,
      provider: metrics.metadata?.modelProvider,
      model: metrics.metadata?.modelName,
      speechId: metrics.speechId,
    });
    emitTurnBreakdown(state, input);
  }

  if (metrics.type === "realtime_model_metrics") {
    if (metrics.ttftMs > 0) {
      state.llmTtftMs = metrics.ttftMs;
    }
    if (metrics.cancelled && state.agentWasSpeakingAtSpeechStart) {
      logLatency("agent_interrupted", {
        turn: state.turn,
        callId: input.callId,
        durationMs: metrics.durationMs,
        requestId: metrics.requestId,
        agentWasSpeakingAtSpeechStart: true,
      });
    }
    logLatency("realtime_model_metrics", {
      turn: state.turn,
      callId: input.callId,
      ttftMs: metrics.ttftMs,
      durationMs: metrics.durationMs,
      cancelled: metrics.cancelled,
      label: metrics.label,
      requestId: metrics.requestId,
    });
  }
}

export function attachLatencyInstrumentation<T>(
  session: voice.AgentSession<T>,
  input?: {
    callId?: string;
    pipelineKind?: LatencyPipelineKind;
    preemptiveConfig?: TurnLatencyBreakdown["preemptiveConfig"];
    ttsConfig?: TurnLatencyBreakdown["ttsConfig"];
  },
) {
  const callId = input?.callId;
  const pipelineKind = input?.pipelineKind ?? "stack";
  const preemptiveConfig = input?.preemptiveConfig ?? {
    enabled: true,
    preemptiveTts: false,
  };
  const ttsConfig = input?.ttsConfig;
  const state: TurnState = {
    turn: 0,
    preemptiveObserved: false,
    hadToolCall: false,
    breakdownEmitted: false,
    suspectedFalseInterruptionCount: 0,
  };

  const ctx = { callId, pipelineKind, preemptiveConfig, ttsConfig };

  session.on(
    AgentSessionEventTypes.UserStateChanged,
    (ev: UserStateChangedEvent) => {
      if (ev.newState === "speaking" && ev.oldState !== "speaking") {
        state.userSpeechStartMs = Date.now();
        state.agentWasSpeakingAtSpeechStart = session.agentState === "speaking";
        logLatency("user_speech_started", {
          turn: state.turn,
          callId,
          agentState: session.agentState,
          agentWasSpeaking: state.agentWasSpeakingAtSpeechStart,
        });
        return;
      }

      if (ev.oldState === "speaking" && ev.newState === "listening") {
        const priorEou = state.eou;
        state.turn += 1;
        state.userSpeechEndMs = Date.now();
        state.sttFinalMs = undefined;
        state.sttTranscript = undefined;
        state.eou = undefined;
        state.llmTtftMs = undefined;
        state.ttsTtfbMs = undefined;
        state.ttsFirstAudioMs = undefined;
        state.agentSpeakingMs = undefined;
        state.toolMs = undefined;
        state.hadToolCall = false;
        state.preemptiveObserved = false;
        state.breakdownEmitted = false;
        if (pipelineKind === "realtime_elevenlabs") {
          const speechAnchor =
            priorEou?.lastSpeakingTimeMs && priorEou.lastSpeakingTimeMs > 0
              ? priorEou.lastSpeakingTimeMs
              : state.userSpeechEndMs;
          resetHybridStreamingTurn({
            turn: state.turn,
            callId,
            speechAnchorMs: speechAnchor,
          });
        }
        logLatency("user_speech_end", { turn: state.turn, callId });
      }
    },
  );

  session.on(
    AgentSessionEventTypes.UserInputTranscribed,
    (ev: UserInputTranscribedEvent) => {
      if (!ev.isFinal) return;
      const now = Date.now();
      if (session.userState === "speaking" && !state.preemptiveObserved) {
        state.preemptiveObserved = true;
        logLatency("preemptive_generation_observed", {
          turn: state.turn,
          callId,
          transcript: ev.transcript,
          userState: session.userState,
        });
      }
      state.sttFinalMs = now;
      state.sttTranscript = ev.transcript;
      const transcript = ev.transcript?.trim() ?? "";
      const speechDurationMs =
        state.userSpeechStartMs != null ? now - state.userSpeechStartMs : undefined;

      if (!transcript) {
        state.suspectedFalseInterruptionCount += 1;
        logLatency("suspected_false_interruption", {
          turn: state.turn,
          callId,
          transcript: "",
          agentWasSpeakingAtStart: state.agentWasSpeakingAtSpeechStart ?? false,
          speechDurationMs,
          cumulativeSuspectedFalse: state.suspectedFalseInterruptionCount,
        });
      }

      logLatency("stt_transcript_final", {
        turn: state.turn,
        callId,
        transcript: ev.transcript,
        language: ev.language,
        latencyMs:
          state.userSpeechEndMs != null ? now - state.userSpeechEndMs : undefined,
        preemptiveObserved: state.preemptiveObserved,
        speechDurationMs,
        agentWasSpeakingAtStart: state.agentWasSpeakingAtSpeechStart ?? false,
      });
    },
  );

  session.on(AgentSessionEventTypes.AgentFalseInterruption, (ev) => {
    logLatency("false_interruption", {
      turn: state.turn,
      callId,
      resumed: ev.resumed,
      cumulativeSuspectedFalse: state.suspectedFalseInterruptionCount,
    });
    if (ev.resumed) {
      logLatency("agent_resumed", { turn: state.turn, callId });
    }
  });

  session.on(
    AgentSessionEventTypes.AgentStateChanged,
    (ev: AgentStateChangedEvent) => {
      if (ev.newState !== "speaking") return;
      const now = Date.now();
      maybeMarkTaskFirstAudio(session);
      if (state.ttsFirstAudioMs == null) {
        state.ttsFirstAudioMs = now;
        if (pipelineKind === "realtime_elevenlabs") {
          markHybridFirstAudio(now);
        }
        if (pipelineKind === "realtime_native") {
          emitTurnBreakdown(state, ctx);
        }
      }
      state.agentSpeakingMs = now;
    },
  );

  session.on(
    AgentSessionEventTypes.MetricsCollected,
    (ev: MetricsCollectedEvent) => {
      recordMetrics(ev.metrics, state, ctx);
    },
  );

  session.on(
    AgentSessionEventTypes.FunctionToolsExecuted,
    (ev: FunctionToolsExecutedEvent) => {
      const started = ev.createdAt || Date.now();
      const finished = Date.now();
      state.hadToolCall = true;
      state.toolMs = finished - started;
      logLatency("tool_executed", {
        turn: state.turn,
        callId,
        toolMs: state.toolMs,
        tools: ev.functionCalls.map((call) => call.name),
      });
      if (!state.breakdownEmitted && state.ttsFirstAudioMs != null) {
        emitTurnBreakdown(state, ctx);
      }
    },
  );
}
