import type { TurnLatencySnapshot } from "./types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

export class TurnLatencyTracker {
  private readonly startedAt = Date.now();
  private sessionLoadMs = 0;
  private routingMs = 0;
  private dbMs = 0;
  private externalMs = 0;
  private marks = new Map<string, number>();
  private lastMark = this.startedAt;

  constructor(
    readonly callId: string,
    readonly sessionId: string,
    readonly stateBefore: WorkflowState,
    readonly conversationId?: string | null,
  ) {}

  mark(label: string): void {
    const now = Date.now();
    this.marks.set(label, now - this.startedAt);
    this.lastMark = now;
  }

  addDb(ms: number): void {
    this.dbMs += ms;
  }

  addExternal(ms: number): void {
    this.externalMs += ms;
  }

  setSessionLoad(ms: number): void {
    this.sessionLoadMs = ms;
  }

  setRouting(ms: number): void {
    this.routingMs = ms;
  }

  snapshot(input: {
    stateAfter: WorkflowState;
    intent?: string;
    decision: string;
    operationStarted?: boolean;
    operationId?: string;
    operationDurationMs?: number;
  }): TurnLatencySnapshot {
    const total = Date.now() - this.startedAt;
    return {
      callId: this.callId,
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      state_before: this.stateBefore,
      intent: input.intent,
      decision: input.decision,
      operation_started: input.operationStarted,
      operation_id: input.operationId,
      operation_duration_ms: input.operationDurationMs,
      state_after: input.stateAfter,
      session_load_ms: this.sessionLoadMs,
      routing_ms: this.routingMs,
      db_duration_ms: this.dbMs,
      external_duration_ms: this.externalMs,
      response_duration_ms: total,
      total_duration_ms: total,
    };
  }

  attach<T extends Record<string, unknown>>(
    response: T,
    snapshot: TurnLatencySnapshot,
  ): T & { _latency: TurnLatencySnapshot } {
    return { ...response, _latency: snapshot };
  }
}

export function logTurnLatency(snapshot: TurnLatencySnapshot): void {
  console.info(
    "[amy.runtime_turn]",
    JSON.stringify({
      callId: snapshot.callId,
      conversationId: snapshot.conversationId,
      sessionId: snapshot.sessionId,
      state_before: snapshot.state_before,
      state_after: snapshot.state_after,
      intent: snapshot.intent,
      decision: snapshot.decision,
      operation_id: snapshot.operation_id,
      operation_duration_ms: snapshot.operation_duration_ms,
      session_load_ms: snapshot.session_load_ms,
      routing_ms: snapshot.routing_ms,
      db_duration_ms: snapshot.db_duration_ms,
      external_duration_ms: snapshot.external_duration_ms,
      total_duration_ms: snapshot.total_duration_ms,
    }),
  );
}
