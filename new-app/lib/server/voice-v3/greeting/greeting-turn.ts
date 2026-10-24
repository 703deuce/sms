import { getLastCommittedCallerUtterance } from "../intake/caller-turn-buffer";
import { VoiceV3CallTrace } from "../telemetry/call-trace";

export type GreetingPhase = "NOT_STARTED" | "SPEAKING" | "INTERRUPTED" | "COMPLETED";

type GreetingRow = {
  phase: GreetingPhase;
  audioOverlapLogged: boolean;
  bargeInLogged: boolean;
};

const rows = new Map<string, GreetingRow>();

function row(sessionId: string): GreetingRow {
  const id = sessionId.trim();
  let r = rows.get(id);
  if (!r) {
    r = { phase: "NOT_STARTED", audioOverlapLogged: false, bargeInLogged: false };
    rows.set(id, r);
  }
  return r;
}

const SUBSTANTIVE_UTTERANCE_MIN_CHARS = 12;

export function markGreetingSpeaking(liveSessionId: string): void {
  const r = row(liveSessionId);
  if (r.phase === "NOT_STARTED") {
    r.phase = "SPEAKING";
  }
}

export function markGreetingCompleted(liveSessionId: string): void {
  const r = row(liveSessionId);
  if (r.phase === "SPEAKING") {
    r.phase = "COMPLETED";
  } else if (r.phase === "NOT_STARTED") {
    r.phase = "COMPLETED";
  }
}

export function markGreetingInterrupted(liveSessionId: string, reason: string): void {
  const r = row(liveSessionId);
  if (r.phase === "SPEAKING" || r.phase === "NOT_STARTED") {
    r.phase = "INTERRUPTED";
    if (!r.bargeInLogged) {
      r.bargeInLogged = true;
      VoiceV3CallTrace.peek(liveSessionId)?.onInterruption();
      console.log("LIVE_GREETING_BARGE_IN", {
        live_session_id: liveSessionId,
        reason,
        ts: new Date().toISOString(),
      });
    }
  }
}

export function getGreetingPhase(liveSessionId: string): GreetingPhase {
  return row(liveSessionId).phase;
}

export function noteCallerSpeechDuringGreeting(liveSessionId: string): void {
  const r = row(liveSessionId);
  if (r.phase !== "SPEAKING") return;

  const utterance = getLastCommittedCallerUtterance(liveSessionId);
  if (utterance.length >= SUBSTANTIVE_UTTERANCE_MIN_CHARS) {
    markGreetingInterrupted(liveSessionId, "substantive_caller_transcript");
    return;
  }

  if (!r.audioOverlapLogged) {
    r.audioOverlapLogged = true;
    console.log("LIVE_GREETING_AUDIO_OVERLAP", {
      live_session_id: liveSessionId,
      utterance_chars: utterance.length,
      ts: new Date().toISOString(),
    });
  }
}

/**
 * Unstable mid-greeting fragment — defer authoritative semantic failure/recovery speak,
 * but still close the function call at the protocol layer.
 */
export function shouldDeferUnstableGreetingSemanticTurn(liveSessionId: string): boolean {
  const phase = getGreetingPhase(liveSessionId);
  if (phase === "INTERRUPTED" || phase === "COMPLETED") return false;
  if (phase !== "SPEAKING") return false;
  const utterance = getLastCommittedCallerUtterance(liveSessionId);
  return utterance.length < SUBSTANTIVE_UTTERANCE_MIN_CHARS;
}

export function clearGreetingTurnState(liveSessionId: string): void {
  rows.delete(liveSessionId.trim());
}
