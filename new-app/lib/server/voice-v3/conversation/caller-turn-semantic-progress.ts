import type { CallerTurn } from "./caller-turn-manager";

export type CallerTurnSemanticStage =
  | "COMMITTED"
  | "DELEGATION_OBSERVED"
  | "FUNCTION_CALL_OBSERVED"
  | "FUNCTION_OUTPUT_SUBMITTED"
  | "DELEGATION_CONTINUED"
  | "MEANING_APPLIED"
  | "TERMINAL_FAILED";

type TurnProgressRow = {
  turnId: string;
  stage: CallerTurnSemanticStage;
  delegationId: string | null;
  functionCallId: string | null;
  fallbackAttempted: boolean;
  updatedAtMs: number;
};

const bySession = new Map<string, Map<string, TurnProgressRow>>();

function sessionMap(liveSessionId: string): Map<string, TurnProgressRow> {
  const id = liveSessionId.trim();
  let m = bySession.get(id);
  if (!m) {
    m = new Map();
    bySession.set(id, m);
  }
  return m;
}

function rowForTurn(liveSessionId: string, turn: CallerTurn): TurnProgressRow {
  const m = sessionMap(liveSessionId);
  let r = m.get(turn.turnId);
  if (!r) {
    r = {
      turnId: turn.turnId,
      stage: "COMMITTED",
      delegationId: null,
      functionCallId: null,
      fallbackAttempted: false,
      updatedAtMs: Date.now(),
    };
    m.set(turn.turnId, r);
  }
  return r;
}

export function ensureTurnProgressCommitted(liveSessionId: string, turn: CallerTurn): void {
  rowForTurn(liveSessionId, turn);
}

export function noteTurnDelegationObserved(
  liveSessionId: string,
  turnId: string,
  delegationId: string | null,
): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  if (r.stage === "MEANING_APPLIED" || r.stage === "TERMINAL_FAILED") return;
  r.stage = "DELEGATION_OBSERVED";
  r.delegationId = delegationId;
  r.updatedAtMs = Date.now();
}

export function noteTurnFunctionCallObserved(
  liveSessionId: string,
  turnId: string,
  functionCallId: string,
): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  if (r.stage === "MEANING_APPLIED" || r.stage === "TERMINAL_FAILED") return;
  r.stage = "FUNCTION_CALL_OBSERVED";
  r.functionCallId = functionCallId;
  r.updatedAtMs = Date.now();
}

export function noteTurnFunctionOutputSubmitted(liveSessionId: string, turnId: string): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  if (r.stage === "MEANING_APPLIED" || r.stage === "TERMINAL_FAILED") return;
  r.stage = "FUNCTION_OUTPUT_SUBMITTED";
  r.updatedAtMs = Date.now();
}

export function noteTurnDelegationContinued(liveSessionId: string, turnId: string): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  if (r.stage === "MEANING_APPLIED" || r.stage === "TERMINAL_FAILED") return;
  r.stage = "DELEGATION_CONTINUED";
  r.updatedAtMs = Date.now();
}

export function noteTurnMeaningApplied(liveSessionId: string, turnId: string): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  r.stage = "MEANING_APPLIED";
  r.updatedAtMs = Date.now();
}

export function noteTurnTerminalFailed(liveSessionId: string, turnId: string): void {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return;
  r.stage = "TERMINAL_FAILED";
  r.updatedAtMs = Date.now();
}

export function markTurnFallbackAttempted(liveSessionId: string, turnId: string): boolean {
  const m = sessionMap(liveSessionId);
  const r = m.get(turnId);
  if (!r) return false;
  if (r.fallbackAttempted) return false;
  r.fallbackAttempted = true;
  r.updatedAtMs = Date.now();
  return true;
}

export function getTurnSemanticStage(
  liveSessionId: string,
  turnId: string,
): CallerTurnSemanticStage | null {
  return sessionMap(liveSessionId).get(turnId)?.stage ?? null;
}

export function clearCallerTurnSemanticProgress(liveSessionId: string): void {
  bySession.delete(liveSessionId.trim());
}
