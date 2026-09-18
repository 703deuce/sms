/**
 * Per-call Voice V3 telemetry — one correlation id, monotonic timeline, hangup summary.
 */

export type VoiceV3TraceMark =
  | "pstn.call.received"
  | "live.transport.incoming"
  | "webhook.verify.completed"
  | "session.accept.request.started"
  | "session.accept.completed"
  | "live.session.started"
  | "greeting.requested"
  | "greeting.audio.started"
  | "greeting.audio.completed"
  | "caller.speech.started"
  | "caller.speech.ended"
  | "caller.transcript.activity"
  | "delegation.created"
  | "astra.response.started"
  | "astra.response.completed"
  | "agent.audio.started"
  | "caller.interruption"
  | "hangup"
  | "session.closed";

export type VoiceV3CallSummary = {
  event: "VOICE_V3_CALL_SUMMARY";
  call_id: string;
  live_session_id: string;
  frontend_model: string;
  backend_model: string;
  duration_ms: number;
  incoming_to_session_accepted_ms: number | null;
  incoming_to_first_audio_ms: number | null;
  median_turn_latency_ms: number | null;
  max_turn_latency_ms: number | null;
  delegation_count: number;
  interruption_count: number;
  errors: string[];
  metrics: Record<string, number | null>;
};

type TimelineEntry = {
  mark: VoiceV3TraceMark | string;
  atMs: number;
  detail?: Record<string, unknown>;
};

const activeTraces = new Map<string, VoiceV3CallTrace>();

export class VoiceV3CallTrace {
  readonly callId: string;
  readonly liveSessionId: string;
  readonly frontendModel: string;
  readonly backendModel: string;
  private readonly t0: number;
  private readonly timeline: TimelineEntry[] = [];
  private delegationCount = 0;
  private interruptionCount = 0;
  private readonly errors: string[] = [];
  private turnLatenciesMs: number[] = [];
  private astraStartMs: number | null = null;

  constructor(input: {
    callId: string;
    liveSessionId: string;
    frontendModel: string;
    backendModel: string;
    originMs?: number;
  }) {
    this.callId = input.callId;
    this.liveSessionId = input.liveSessionId;
    this.frontendModel = input.frontendModel;
    this.backendModel = input.backendModel;
    this.t0 = input.originMs ?? Date.now();
  }

  static getOrCreate(input: {
    liveSessionId: string;
    callId?: string | null;
    frontendModel: string;
    backendModel: string;
  }): VoiceV3CallTrace {
    const sessionId = input.liveSessionId.trim();
    const existing = activeTraces.get(sessionId);
    if (existing) return existing;
    const callId = input.callId?.trim() || sessionId;
    const trace = new VoiceV3CallTrace({
      callId,
      liveSessionId: sessionId,
      frontendModel: input.frontendModel,
      backendModel: input.backendModel,
    });
    activeTraces.set(sessionId, trace);
    if (activeTraces.size > 500) {
      const first = activeTraces.keys().next().value;
      if (first) activeTraces.delete(first);
    }
    return trace;
  }

  static peek(sessionId: string): VoiceV3CallTrace | undefined {
    return activeTraces.get(sessionId);
  }

  mark(mark: VoiceV3TraceMark | string, detail?: Record<string, unknown>): void {
    this.timeline.push({ mark, atMs: Date.now(), detail });
  }

  markAt(mark: VoiceV3TraceMark | string, atMs: number, detail?: Record<string, unknown>): void {
    this.timeline.push({ mark, atMs, detail });
  }

  recordError(message: string): void {
    this.errors.push(message);
  }

  onDelegationCreated(): void {
    this.delegationCount += 1;
    this.mark("delegation.created");
  }

  onAstraResponseEvent(nestedType?: string): void {
    if (nestedType === "response.created" || nestedType === "response.in_progress") {
      if (this.astraStartMs === null) {
        this.astraStartMs = Date.now();
        this.mark("astra.response.started", { nestedType });
      }
    }
    if (
      nestedType === "response.completed" ||
      nestedType === "response.done" ||
      nestedType === "response.output_item.done"
    ) {
      if (this.astraStartMs !== null) {
        this.turnLatenciesMs.push(Date.now() - this.astraStartMs);
        this.astraStartMs = null;
      }
      this.mark("astra.response.completed", { nestedType });
    }
  }

  onInterruption(): void {
    this.interruptionCount += 1;
    this.mark("caller.interruption");
  }

  firstMarkMs(mark: VoiceV3TraceMark | string): number | null {
    const sorted = [...this.timeline].sort((a, b) => a.atMs - b.atMs);
    const entry = sorted.find((e) => e.mark === mark);
    return entry ? entry.atMs - this.t0 : null;
  }

  metricMs(from: VoiceV3TraceMark | string, to: VoiceV3TraceMark | string): number | null {
    const sorted = [...this.timeline].sort((a, b) => a.atMs - b.atMs);
    const a = sorted.find((e) => e.mark === from);
    const b = sorted.find((e) => e.mark === to);
    if (!a || !b) return null;
    return b.atMs - a.atMs;
  }

  computeDerivedMetrics(): Record<string, number | null> {
    const incoming = this.firstMarkMs("live.transport.incoming");
    const verifyDone = this.firstMarkMs("webhook.verify.completed");
    const acceptStart = this.firstMarkMs("session.accept.request.started");
    const acceptDone = this.firstMarkMs("session.accept.completed");
    const greetingReq = this.firstMarkMs("greeting.requested");
    const firstAudio = this.firstMarkMs("greeting.audio.started");

    const diff = (end: number | null, start: number | null) =>
      end !== null && start !== null ? end - start : null;

    const pstn = this.firstMarkMs("pstn.call.received");

    return {
      incoming_to_webhook_ms: pstn !== null && incoming !== null ? incoming - pstn : incoming,
      webhook_verify_ms: this.metricMs("live.transport.incoming", "webhook.verify.completed"),
      webhook_to_accept_start_ms: this.metricMs("webhook.verify.completed", "session.accept.request.started"),
      accept_api_ms: this.metricMs("session.accept.request.started", "session.accept.completed"),
      incoming_to_session_accepted_ms: diff(acceptDone, incoming),
      accepted_to_greeting_request_ms: diff(greetingReq, acceptDone),
      accepted_to_first_audio_ms: diff(firstAudio, acceptDone),
      incoming_to_first_audio_ms: diff(firstAudio, incoming),
      caller_end_to_agent_audio_ms: this.metricMs("caller.speech.ended", "agent.audio.started"),
      delegation_latency_ms: this.metricMs("delegation.created", "astra.response.completed"),
      astra_latency_ms:
        this.turnLatenciesMs.length > 0
          ? Math.round(
              this.turnLatenciesMs.reduce((a, b) => a + b, 0) / this.turnLatenciesMs.length,
            )
          : null,
      total_call_duration_ms: this.timeline.length
        ? this.timeline[this.timeline.length - 1]!.atMs - this.t0
        : null,
    };
  }

  finalize(reason: string = "hangup"): VoiceV3CallSummary {
    this.mark(reason === "session.closed" ? "session.closed" : "hangup", { reason });
    const metrics = this.computeDerivedMetrics();
    const sorted = [...this.turnLatenciesMs].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]!
          : Math.round((sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2);
    const summary: VoiceV3CallSummary = {
      event: "VOICE_V3_CALL_SUMMARY",
      call_id: this.callId,
      live_session_id: this.liveSessionId,
      frontend_model: this.frontendModel,
      backend_model: this.backendModel,
      duration_ms: metrics.total_call_duration_ms ?? 0,
      incoming_to_session_accepted_ms: metrics.incoming_to_session_accepted_ms,
      incoming_to_first_audio_ms: metrics.incoming_to_first_audio_ms,
      median_turn_latency_ms: median,
      max_turn_latency_ms: sorted.length ? sorted[sorted.length - 1]! : null,
      delegation_count: this.delegationCount,
      interruption_count: this.interruptionCount,
      errors: [...this.errors],
      metrics,
    };
    const sessionId = this.liveSessionId;
    activeTraces.delete(sessionId);
    flushVoiceV3TelemetryAsync(summary, this.timeline, this.callId);
    return summary;
  }

  buildHumanTimelineText(): string {
    const lines: string[] = [`VOICE V3 CALL ${this.callId}`];
    const sorted = [...this.timeline].sort((a, b) => a.atMs - b.atMs);
    for (const entry of sorted) {
      const offset = String(entry.atMs - this.t0).padStart(4, "0");
      lines.push(`+${offset}ms  ${entry.mark}`);
    }
    return lines.join("\n");
  }
}

/** Non-blocking: never await in call path. */
function flushVoiceV3TelemetryAsync(
  summary: VoiceV3CallSummary,
  timeline: TimelineEntry[],
  callId: string,
): void {
  const t0 = timeline[0]?.atMs ?? Date.now();
  queueMicrotask(() => {
    try {
      const lines: string[] = [`VOICE V3 CALL ${callId}`];
      const sorted = [...timeline].sort((a, b) => a.atMs - b.atMs);
      for (const entry of sorted) {
        const offset = String(entry.atMs - t0).padStart(4, "0");
        lines.push(`+${offset}ms  ${entry.mark}`);
      }
      console.log(lines.join("\n"));
      console.log("VOICE_V3_CALL_SUMMARY", summary);
    } catch (err) {
      console.error("VOICE_V3_TELEMETRY_FLUSH_FAILED", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

let lastPstnLeg: { callControlId: string; atMs: number } | null = null;

export function noteTelnyxPstnReceived(callControlId: string): void {
  if (!callControlId.trim()) return;
  lastPstnLeg = { callControlId, atMs: Date.now() };
}

/** Correlate the most recent PSTN leg with the next Live session (single-line test calls). */
export function consumeRecentPstnLeg(maxAgeMs = 120_000): { callControlId: string; atMs: number } | null {
  if (!lastPstnLeg) return null;
  if (Date.now() - lastPstnLeg.atMs > maxAgeMs) {
    lastPstnLeg = null;
    return null;
  }
  const leg = lastPstnLeg;
  lastPstnLeg = null;
  return leg;
}
