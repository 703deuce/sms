import { performance } from "node:perf_hooks";

import type { CallerAudioActivityEvent } from "./live-caller-audio-activity";

export function isLiveInputTranscriptDelta(type: string): boolean {
  return (
    type === "input_transcript.delta" ||
    type === "session.input_transcript.delta"
  );
}

export function isLiveOutputTranscriptDelta(type: string): boolean {
  return type === "output_transcript.delta" || type === "session.output_transcript.delta";
}

type TurnFlags = {
  delegated: boolean;
  toolCalled: boolean;
};

type TurnTimestamps = {
  callerAudioFirst?: number;
  callerAudioLast?: number;
  liveInputTranscriptFirst?: number;
  liveInputTranscriptLastSeen?: number;
  delegationCreated?: number;
  firstResponseEvent?: number;
  firstOutputTranscript?: number;
  firstOutputAudioDelta?: number;
  firstAudioSentToTelnyx?: number;
  callerAudioEndedEstimate?: number;
};

type ActiveTurn = {
  n: number;
  t: TurnTimestamps;
  flags: TurnFlags;
  inputTranscriptChars: number;
  outputTranscriptChars: number;
  firstResponseEventType?: string;
  toolNames: string[];
};

function perfMs(): number {
  return performance.now();
}

function logTurnEvent(callId: string, turn: number, name: string, extra?: Record<string, unknown>) {
  console.info(
    `LIVE_TURN TURN_${turn}_${name} ${JSON.stringify({
      callId,
      perf_ms: perfMs(),
      ...extra,
    })}`,
  );
}

/**
 * Per caller→Amy turn timeline (bridge-local performance.now()).
 * Does not gate responses — observability only.
 */
export class LiveTurnTracer {
  private readonly callId: string;
  private turnNumber = 0;
  private active: ActiveTurn | null = null;
  private awaitingCallerTurn = true;
  private turnFinalized = false;
  private lastAmyOutputAudioPerf = 0;
  private telnyxForwardSampleEvery = 50;
  private inboundFrameCount = 0;

  constructor(callId: string) {
    this.callId = callId;
  }

  private startTurn(): ActiveTurn {
    this.turnNumber += 1;
    const turn: ActiveTurn = {
      n: this.turnNumber,
      t: {},
      flags: { delegated: false, toolCalled: false },
      inputTranscriptChars: 0,
      outputTranscriptChars: 0,
      toolNames: [],
    };
    this.active = turn;
    this.awaitingCallerTurn = false;
    return turn;
  }

  /** Attach Amy/delegation events to the current caller turn without opening a new turn. */
  private activeTurnOrNull(): ActiveTurn | null {
    return this.active;
  }

  /** Caller-side events may open a turn; Amy-only events must not. */
  private ensureCallerTurn(): ActiveTurn {
    if (!this.active) {
      return this.startTurn();
    }
    return this.active;
  }

  private finalizeTurn(reason: string) {
    if (!this.active) return;
    const turn = this.active;
    this.logInputTranscriptLastSeen(turn);
    const t = turn.t;
    const callerEnd = t.callerAudioEndedEstimate ?? t.callerAudioLast ?? t.liveInputTranscriptLastSeen;
    const liveTurnLatencyMs =
      callerEnd != null && t.firstOutputAudioDelta != null
        ? Math.round(t.firstOutputAudioDelta - callerEnd)
        : null;

    console.info(
      `LIVE_TURN_SUMMARY ${JSON.stringify({
        callId: this.callId,
        turn: turn.n,
        reason,
        delegated: turn.flags.delegated,
        tool_called: turn.flags.toolCalled,
        tool_names: turn.toolNames,
        live_turn_latency_ms: liveTurnLatencyMs,
        caller_audio_end_to_delegation_ms:
          callerEnd != null && t.delegationCreated != null
            ? Math.round(t.delegationCreated - callerEnd)
            : null,
        caller_audio_end_to_first_output_audio_ms: liveTurnLatencyMs,
        delegation_to_first_response_event_ms:
          t.delegationCreated != null && t.firstResponseEvent != null
            ? Math.round(t.firstResponseEvent - t.delegationCreated)
            : null,
        first_output_audio_to_telnyx_ms:
          t.firstOutputAudioDelta != null && t.firstAudioSentToTelnyx != null
            ? Math.round(t.firstAudioSentToTelnyx - t.firstOutputAudioDelta)
            : null,
        timestamps_perf_ms: t,
        first_response_event_type: turn.firstResponseEventType ?? null,
      })}`,
    );
    this.active = null;
    this.awaitingCallerTurn = true;
    this.turnFinalized = true;
  }

  onCallerActivity(event: CallerAudioActivityEvent) {
    if (event.type === "CALLER_AUDIO_STARTED") {
      if (this.active && !this.turnFinalized) {
        this.finalizeTurn("new_caller_audio_before_amy_response");
      }
      const turn = this.startTurn();
      this.turnFinalized = false;
      turn.t.callerAudioFirst = event.perfMs;
      logTurnEvent(this.callId, turn.n, "CALLER_AUDIO_FIRST", { perf_ms: event.perfMs });
      return;
    }
    if (event.type === "CALLER_AUDIO_ENDED_ESTIMATE") {
      const turn = this.ensureCallerTurn();
      turn.t.callerAudioLast = event.perfMs;
      turn.t.callerAudioEndedEstimate = event.perfMs;
      logTurnEvent(this.callId, turn.n, "CALLER_AUDIO_LAST", { perf_ms: event.perfMs });
      logTurnEvent(this.callId, turn.n, "CALLER_AUDIO_ENDED_ESTIMATE", {
        perf_ms: event.perfMs,
      });
      this.logInputTranscriptLastSeen(turn);
    }
  }

  onTelnyxInboundFrame(telnyxReceivedPerf: number, forwardedPerf: number) {
    this.inboundFrameCount += 1;
    if (this.inboundFrameCount % this.telnyxForwardSampleEvery !== 0) return;
    console.info(
      `LIVE_MEDIA_SAMPLE ${JSON.stringify({
        callId: this.callId,
        kind: "telnyx_to_openai_forward",
        frame: this.inboundFrameCount,
        telnyx_received_perf_ms: telnyxReceivedPerf,
        forwarded_perf_ms: forwardedPerf,
        forward_delay_ms: Math.round(forwardedPerf - telnyxReceivedPerf),
      })}`,
    );
  }

  onLiveInputTranscriptDelta(delta: string, event: Record<string, unknown>) {
    const turn = this.ensureCallerTurn();
    const now = perfMs();
    if (turn.t.liveInputTranscriptFirst == null) {
      turn.t.liveInputTranscriptFirst = now;
      logTurnEvent(this.callId, turn.n, "LIVE_INPUT_TRANSCRIPT_FIRST", {
        perf_ms: now,
        start_ms: event.start_ms ?? null,
        end_ms: event.end_ms ?? null,
      });
    }
    turn.t.liveInputTranscriptLastSeen = now;
    turn.inputTranscriptChars += delta.length;
  }

  private logInputTranscriptLastSeen(turn: ActiveTurn) {
    const now = turn.t.liveInputTranscriptLastSeen;
    if (now == null) return;
    logTurnEvent(this.callId, turn.n, "LIVE_INPUT_TRANSCRIPT_LAST_SEEN", {
      perf_ms: now,
      total_chars: turn.inputTranscriptChars,
    });
  }

  onDelegationCreated(delegationId: string | null) {
    const turn = this.activeTurnOrNull();
    if (!turn) return;
    if (turn.t.delegationCreated != null) return;
    turn.flags.delegated = true;
    turn.t.delegationCreated = perfMs();
    logTurnEvent(this.callId, turn.n, "DELEGATION_CREATED", {
      perf_ms: turn.t.delegationCreated,
      delegation_id: delegationId,
    });
  }

  onFirstResponseEvent(responseType: string, delegationId: string | null) {
    const turn = this.activeTurnOrNull();
    if (!turn) return;
    if (turn.t.firstResponseEvent != null) return;
    turn.t.firstResponseEvent = perfMs();
    turn.firstResponseEventType = responseType;
    logTurnEvent(this.callId, turn.n, "FIRST_RESPONSE_EVENT", {
      perf_ms: turn.t.firstResponseEvent,
      response_type: responseType,
      delegation_id: delegationId,
    });
  }

  onToolCalled(toolName: string) {
    const turn = this.activeTurnOrNull();
    if (!turn) return;
    turn.flags.toolCalled = true;
    if (!turn.toolNames.includes(toolName)) {
      turn.toolNames.push(toolName);
    }
  }

  onLiveOutputTranscriptDelta(delta: string, event: Record<string, unknown>) {
    const turn = this.activeTurnOrNull();
    if (!turn) return;
    const now = perfMs();
    if (turn.t.firstOutputTranscript == null) {
      turn.t.firstOutputTranscript = now;
      logTurnEvent(this.callId, turn.n, "FIRST_OUTPUT_TRANSCRIPT", {
        perf_ms: now,
        start_ms: event.start_ms ?? null,
        end_ms: event.end_ms ?? null,
      });
    }
    turn.outputTranscriptChars += delta.length;
  }

  onFirstOutputAudioDelta(event: Record<string, unknown>) {
    let turn = this.activeTurnOrNull();
    if (!turn && this.awaitingCallerTurn) {
      turn = this.startTurn();
      this.turnFinalized = false;
    }
    if (!turn) return;
    const now = perfMs();
    if (turn.t.firstOutputAudioDelta != null) return;
    turn.t.firstOutputAudioDelta = now;
    logTurnEvent(this.callId, turn.n, "FIRST_OUTPUT_AUDIO_DELTA", {
      perf_ms: now,
      start_ms: event.start_ms ?? null,
      end_ms: event.end_ms ?? null,
    });
    this.lastAmyOutputAudioPerf = now;
  }

  onFirstAudioSentToTelnyx(openAiDeltaPerf: number) {
    const turn = this.activeTurnOrNull();
    if (!turn) return;
    const now = perfMs();
    if (turn.t.firstAudioSentToTelnyx != null) return;
    turn.t.firstAudioSentToTelnyx = now;
    logTurnEvent(this.callId, turn.n, "FIRST_AUDIO_SENT_TO_TELNYX", {
      perf_ms: now,
      openai_delta_perf_ms: openAiDeltaPerf,
      openai_to_telnyx_ms: Math.round(now - openAiDeltaPerf),
    });
    if (!this.turnFinalized) {
      this.finalizeTurn("caller_turn_amy_response_started");
    }
  }

  noteOutboundResponseCreate() {
    console.info(
      `LIVE_BRIDGE_OBS ${JSON.stringify({
        callId: this.callId,
        event: "response.create_sent",
        note: "post_tool_only_expected",
        perf_ms: perfMs(),
      })}`,
    );
  }
}

export type LiveTurnTraceHooks = {
  onDelegationCreated: (delegationId: string | null) => void;
  onFirstResponseEvent: (responseType: string, delegationId: string | null) => void;
  onToolCalled: (toolName: string) => void;
  onResponseCreateSent: () => void;
};

export function createTurnTraceHooks(tracer: LiveTurnTracer): LiveTurnTraceHooks {
  return {
    onDelegationCreated: (id) => tracer.onDelegationCreated(id),
    onFirstResponseEvent: (type, id) => tracer.onFirstResponseEvent(type, id),
    onToolCalled: (name) => tracer.onToolCalled(name),
    onResponseCreateSent: () => tracer.noteOutboundResponseCreate(),
  };
}
