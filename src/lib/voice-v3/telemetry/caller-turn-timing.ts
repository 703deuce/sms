export type CallerTurnTiming = {
  turnId: string;
  turnSequence: number;
  callerSpeechStartedAt?: number;
  callerSpeechEndedAt?: number;
  transcriptFirstFragmentAt?: number;
  transcriptLastFragmentAt?: number;
  turnCommittedAt: number;
  delegationRequestedAt?: number;
  delegationCreatedAt?: number;
  astraResponseCreatedAt?: number;
  functionCallCompletedAt?: number;
  functionOutputSubmittedAt?: number;
  delegatedContinuationAt?: number;
  delegationCompletedAt?: number;
  meaningAppliedAt?: number;
  runtimeCommittedAt?: number;
  plannerCompletedAt?: number;
  liveContextSentAt?: number;
  responseCreateSentAt?: number;
  agentAudioStartedAt?: number;
  agentAudioCompletedAt?: number;
  semanticRetryCount: number;
  delegationCount: number;
  responseCreateCount: number;
  transcriptFragmentCount: number;
};

type SessionTiming = {
  byTurnId: Map<string, CallerTurnTiming>;
  activeTurnId: string | null;
  lastTurnSequence: number;
};

const sessions = new Map<string, SessionTiming>();

function session(liveSessionId: string): SessionTiming {
  const id = liveSessionId.trim();
  let s = sessions.get(id);
  if (!s) {
    s = { byTurnId: new Map(), activeTurnId: null, lastTurnSequence: 0 };
    sessions.set(id, s);
  }
  return s;
}

function ensureTurn(liveSessionId: string, turnId: string, turnSequence: number): CallerTurnTiming {
  const s = session(liveSessionId);
  let row = s.byTurnId.get(turnId);
  if (!row) {
    row = {
      turnId,
      turnSequence,
      turnCommittedAt: Date.now(),
      semanticRetryCount: 0,
      delegationCount: 0,
      responseCreateCount: 0,
      transcriptFragmentCount: 0,
    };
    s.byTurnId.set(turnId, row);
  }
  s.activeTurnId = turnId;
  s.lastTurnSequence = turnSequence;
  return row;
}

export function noteCallerTurnTimingCommitted(input: {
  liveSessionId: string;
  turnId: string;
  turnSequence: number;
}): void {
  const row = ensureTurn(input.liveSessionId, input.turnId, input.turnSequence);
  row.turnCommittedAt = Date.now();
}

export function noteCallerTranscriptFragmentTiming(liveSessionId: string): void {
  const s = session(liveSessionId);
  const turnId = s.activeTurnId;
  if (!turnId) return;
  const row = s.byTurnId.get(turnId);
  if (!row) return;
  const now = Date.now();
  row.transcriptFragmentCount += 1;
  if (row.transcriptFirstFragmentAt == null) {
    row.transcriptFirstFragmentAt = now;
  }
  row.transcriptLastFragmentAt = now;
}

export function noteCallerSpeechStartedTiming(liveSessionId: string): void {
  const s = session(liveSessionId);
  const turnId = s.activeTurnId ?? `turn_${liveSessionId}_${s.lastTurnSequence || "pending"}`;
  const row =
    s.byTurnId.get(turnId) ??
    ensureTurn(liveSessionId, turnId, s.lastTurnSequence || 0);
  if (row.callerSpeechStartedAt == null) {
    row.callerSpeechStartedAt = Date.now();
  }
}

export function noteSemanticTimingEvent(
  liveSessionId: string,
  field: keyof CallerTurnTiming,
  turnId?: string | null,
): void {
  const s = session(liveSessionId);
  const id = turnId ?? s.activeTurnId;
  if (!id) return;
  const row = s.byTurnId.get(id);
  if (!row) return;
  if (field.endsWith("Count")) {
    const key = field as "semanticRetryCount" | "delegationCount" | "responseCreateCount";
    row[key] += 1;
    return;
  }
  const now = Date.now();
  (row as Record<string, number | undefined>)[field] = now;
}

export function getCallerTurnTiming(liveSessionId: string, turnId: string): CallerTurnTiming | null {
  return session(liveSessionId).byTurnId.get(turnId) ?? null;
}

export function logCallerTurnTimingSummary(liveSessionId: string, turnId: string): void {
  const row = getCallerTurnTiming(liveSessionId, turnId);
  if (!row) return;
  const d = deriveCallerTurnDurations(row);
  console.log("CALLER_TURN_TIMING", {
    live_session_id: liveSessionId,
    turn_id: turnId,
    turn_sequence: row.turnSequence,
    ...d,
    semantic_retry_count: row.semanticRetryCount,
    delegation_count: row.delegationCount,
    response_create_count: row.responseCreateCount,
    transcript_fragment_count: row.transcriptFragmentCount,
  });
}

export function deriveCallerTurnDurations(row: CallerTurnTiming): Record<string, number | null> {
  const diff = (a?: number, b?: number) =>
    a != null && b != null ? Math.max(0, b - a) : null;

  return {
    speech_duration_ms: diff(row.callerSpeechStartedAt, row.callerSpeechEndedAt),
    speech_end_to_turn_commit_ms: diff(row.callerSpeechEndedAt, row.turnCommittedAt),
    turn_commit_to_delegation_ms: diff(row.turnCommittedAt, row.delegationCreatedAt),
    delegation_to_function_call_ms: diff(row.delegationCreatedAt, row.functionCallCompletedAt),
    function_call_to_output_submit_ms: diff(row.functionCallCompletedAt, row.functionOutputSubmittedAt),
    continuation_to_delegation_complete_ms: diff(
      row.delegatedContinuationAt,
      row.delegationCompletedAt,
    ),
    meaning_apply_ms: diff(row.functionOutputSubmittedAt, row.meaningAppliedAt),
    runtime_to_planner_ms: diff(row.runtimeCommittedAt, row.plannerCompletedAt),
    planner_to_response_create_ms: diff(row.plannerCompletedAt, row.responseCreateSentAt),
    response_create_to_audio_start_ms: diff(row.responseCreateSentAt, row.agentAudioStartedAt),
    audio_duration_ms: diff(row.agentAudioStartedAt, row.agentAudioCompletedAt),
    total_turn_to_next_audio_ms: diff(row.turnCommittedAt, row.agentAudioStartedAt),
  };
}

export function clearCallerTurnTiming(liveSessionId: string): void {
  sessions.delete(liveSessionId.trim());
}
