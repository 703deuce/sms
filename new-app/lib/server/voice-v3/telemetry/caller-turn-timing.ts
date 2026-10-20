export type TurnPathKind = "HAPPY_PATH" | "RETRY" | "RECOVERY" | "STALE" | "ERROR" | "EMPTY_IGNORED";

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
  astraFirstOutputAt?: number;
  functionCallCompletedAt?: number;
  functionOutputSubmittedAt?: number;
  delegatedContinuationRequestedAt?: number;
  delegatedResponseCompletedAt?: number;
  meaningValidatedAt?: number;
  runtimeCommittedAt?: number;
  plannerCompletedAt?: number;
  liveContextSentAt?: number;
  responseCreateRequestedAt?: number;
  agentAudioStartedAt?: number;
  agentAudioCompletedAt?: number;
  semanticRetryCount: number;
  delegationCount: number;
  responseCreateCount: number;
  transcriptFragmentCount: number;
  backendOperationsDispatched: string[];
  recoverySpeakCount: number;
  semanticSource?: "delegation" | "semantic_retry";
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
      backendOperationsDispatched: [],
      recoverySpeakCount: 0,
    };
    s.byTurnId.set(turnId, row);
  }
  s.activeTurnId = turnId;
  s.lastTurnSequence = turnSequence;
  return row;
}

export function classifyTurnPath(row: CallerTurnTiming): TurnPathKind {
  if (row.semanticSource === "semantic_retry" || row.semanticRetryCount > 0) {
    return "RETRY";
  }
  if (row.recoverySpeakCount > 0) {
    return "RECOVERY";
  }
  return "HAPPY_PATH";
}

export function noteCallerTurnTimingCommitted(input: {
  liveSessionId: string;
  turnId: string;
  turnSequence: number;
}): void {
  const row = ensureTurn(input.liveSessionId, input.turnId, input.turnSequence);
  const now = Date.now();
  row.turnCommittedAt = now;
  if (row.transcriptLastFragmentAt != null && row.callerSpeechEndedAt == null) {
    row.callerSpeechEndedAt = row.transcriptLastFragmentAt;
  }
}

export function capturingTurnId(liveSessionId: string): string {
  return `capturing_${liveSessionId.trim()}`;
}

export function mergeCapturingTranscriptTimingIntoTurn(
  liveSessionId: string,
  committedTurnId: string,
): void {
  const cap = getCallerTurnTiming(liveSessionId, capturingTurnId(liveSessionId));
  const row = getCallerTurnTiming(liveSessionId, committedTurnId);
  if (!cap || !row || cap.transcriptFirstFragmentAt == null) return;
  row.callerSpeechStartedAt = cap.callerSpeechStartedAt ?? cap.transcriptFirstFragmentAt;
  row.transcriptFirstFragmentAt = cap.transcriptFirstFragmentAt;
  row.transcriptLastFragmentAt = cap.transcriptLastFragmentAt;
  row.transcriptFragmentCount = cap.transcriptFragmentCount;
  if (cap.transcriptLastFragmentAt) {
    row.callerSpeechEndedAt = cap.transcriptLastFragmentAt;
  }
}

export function noteCallerTranscriptFragmentTiming(liveSessionId: string): void {
  const s = session(liveSessionId);
  const turnId = capturingTurnId(liveSessionId);
  ensureTurn(liveSessionId, turnId, s.lastTurnSequence + 1);
  const row = s.byTurnId.get(turnId);
  if (!row) return;
  const now = Date.now();
  row.transcriptFragmentCount += 1;
  if (row.transcriptFirstFragmentAt == null) {
    row.transcriptFirstFragmentAt = now;
    row.callerSpeechStartedAt = now;
  }
  row.transcriptLastFragmentAt = now;
  s.activeTurnId = turnId;
}

export function noteCallerSpeechStartedTiming(liveSessionId: string, turnId?: string): void {
  const s = session(liveSessionId);
  const id = turnId ?? s.activeTurnId ?? `turn_${liveSessionId}_${s.lastTurnSequence || "pending"}`;
  const row =
    s.byTurnId.get(id) ??
    ensureTurn(liveSessionId, id, s.lastTurnSequence || 0);
  if (row.callerSpeechStartedAt == null) {
    row.callerSpeechStartedAt = Date.now();
  }
  s.activeTurnId = id;
}

export function noteBackendOperationDispatched(
  liveSessionId: string,
  operationId: string,
  turnId?: string | null,
): void {
  const s = session(liveSessionId);
  const id = turnId ?? s.activeTurnId;
  if (!id) return;
  const row = s.byTurnId.get(id);
  if (!row) return;
  if (!row.backendOperationsDispatched.includes(operationId)) {
    row.backendOperationsDispatched.push(operationId);
  }
}

export function noteMeaningValidatedForTurn(liveSessionId: string, turnId: string): void {
  const row = ensureTurn(liveSessionId, turnId, session(liveSessionId).lastTurnSequence);
  row.meaningValidatedAt = Date.now();
}

export function noteRuntimeCommittedForTurn(
  liveSessionId: string,
  turnId: string,
  _stateVersion: number,
): void {
  const row = ensureTurn(liveSessionId, turnId, session(liveSessionId).lastTurnSequence);
  row.runtimeCommittedAt = Date.now();
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
    const key = field as "semanticRetryCount" | "delegationCount" | "responseCreateCount" | "recoverySpeakCount";
    row[key] += 1;
    return;
  }
  if (field === "backendOperationsDispatched" || field === "semanticSource") {
    return;
  }
  const now = Date.now();
  (row as Record<string, number | undefined>)[field] = now;
  if (field === "delegatedContinuationAt") {
    row.delegatedContinuationRequestedAt = now;
  }
  if (field === "delegationCompletedAt") {
    row.delegatedResponseCompletedAt = now;
  }
  if (field === "responseCreateSentAt") {
    row.responseCreateRequestedAt = now;
  }
  if (field === "astraResponseCreatedAt") {
    row.astraFirstOutputAt = now;
  }
}

export function getCallerTurnTiming(liveSessionId: string, turnId: string): CallerTurnTiming | null {
  return session(liveSessionId).byTurnId.get(turnId) ?? null;
}

export function deriveCallerTurnDurations(row: CallerTurnTiming): Record<string, number | null> {
  const diff = (a?: number, b?: number) =>
    a != null && b != null ? Math.max(0, b - a) : null;

  const speechEnded = row.callerSpeechEndedAt ?? row.transcriptLastFragmentAt;

  return {
    speech_duration_ms: diff(row.callerSpeechStartedAt, speechEnded),
    speech_end_to_turn_commit_ms: diff(speechEnded, row.turnCommittedAt),
    turn_commit_to_delegation_ms: diff(row.turnCommittedAt, row.delegationCreatedAt),
    delegation_to_function_call_ms: diff(row.delegationCreatedAt, row.functionCallCompletedAt),
    function_call_to_output_submit_ms: diff(row.functionCallCompletedAt, row.functionOutputSubmittedAt),
    continuation_to_delegation_complete_ms: diff(
      row.delegatedContinuationRequestedAt,
      row.delegatedResponseCompletedAt,
    ),
    meaning_validate_to_runtime_commit_ms: diff(row.meaningValidatedAt, row.runtimeCommittedAt),
    runtime_to_planner_ms: diff(row.runtimeCommittedAt, row.plannerCompletedAt),
    planner_to_response_create_ms: diff(row.plannerCompletedAt, row.responseCreateRequestedAt),
    response_create_to_audio_start_ms: diff(row.responseCreateRequestedAt, row.agentAudioStartedAt),
    audio_duration_ms: diff(row.agentAudioStartedAt, row.agentAudioCompletedAt),
    total_caller_stop_to_agent_audio_ms: diff(speechEnded, row.agentAudioStartedAt),
    total_turn_commit_to_agent_audio_ms: diff(row.turnCommittedAt, row.agentAudioStartedAt),
  };
}

export function finalizeCallerTurnTiming(input: {
  liveSessionId: string;
  turnId: string;
  source: "delegation" | "semantic_retry";
}): void {
  const row = getCallerTurnTiming(input.liveSessionId, input.turnId);
  if (!row) return;
  row.semanticSource = input.source;
  const turn_path = classifyTurnPath(row);
  const d = deriveCallerTurnDurations(row);
  console.log("CALLER_TURN_TIMING", {
    live_session_id: input.liveSessionId,
    turn_id: input.turnId,
    turn_sequence: row.turnSequence,
    turn_path,
    semantic_source: row.semanticSource,
    overlapped_operations: row.backendOperationsDispatched,
    timestamps: {
      caller_speech_started_at: row.callerSpeechStartedAt,
      caller_speech_ended_at: row.callerSpeechEndedAt ?? row.transcriptLastFragmentAt,
      turn_committed_at: row.turnCommittedAt,
      delegation_created_at: row.delegationCreatedAt,
      astra_first_output_at: row.astraFirstOutputAt,
      function_call_complete_at: row.functionCallCompletedAt,
      function_output_submitted_at: row.functionOutputSubmittedAt,
      delegated_continuation_requested_at: row.delegatedContinuationRequestedAt,
      delegated_response_completed_at: row.delegatedResponseCompletedAt,
      meaning_validated_at: row.meaningValidatedAt,
      runtime_committed_at: row.runtimeCommittedAt,
      planner_completed_at: row.plannerCompletedAt,
      live_context_sent_at: row.liveContextSentAt,
      response_create_requested_at: row.responseCreateRequestedAt,
      agent_audio_started_at: row.agentAudioStartedAt,
      agent_audio_completed_at: row.agentAudioCompletedAt,
    },
    ...d,
    semantic_retry_count: row.semanticRetryCount,
    delegation_count: row.delegationCount,
    response_create_count: row.responseCreateCount,
    transcript_fragment_count: row.transcriptFragmentCount,
    recovery_speak_count: row.recoverySpeakCount,
  });
}

/** @deprecated Prefer finalizeCallerTurnTiming */
export function logCallerTurnTimingSummary(liveSessionId: string, turnId: string): void {
  finalizeCallerTurnTiming({ liveSessionId, turnId, source: "delegation" });
}

export function clearCallerTurnTiming(liveSessionId: string): void {
  sessions.delete(liveSessionId.trim());
}

export function exportAllCallerTurnTimingForSession(liveSessionId: string): CallerTurnTiming[] {
  const s = sessions.get(liveSessionId.trim());
  if (!s) return [];
  return [...s.byTurnId.values()].sort((a, b) => a.turnSequence - b.turnSequence);
}
