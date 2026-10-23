import type { AnswerClassification } from "./types";

export type ConnectionPhase =
  | "dialing"
  | "ringing"
  | "answer_detected"
  | "checking_answer"
  | "screening_detected"
  | "waiting_for_recipient"
  | "human_connected"
  | "voicemail"
  | "screening_declined"
  | "call_ended";

export function deriveConnectionPhase(input: {
  attemptStatus: string;
  humanCallStatus?: string | null;
  answerClassification?: AnswerClassification | string | null;
  metadataConnectionPhase?: string | null;
  screeningPending?: boolean;
}): ConnectionPhase {
  if (input.metadataConnectionPhase) {
    const p = input.metadataConnectionPhase as ConnectionPhase;
    if (isConnectionPhase(p)) return p;
  }
  const st = input.attemptStatus.toLowerCase();
  if (st === "completed" || st === "cancelled" || st === "no_answer" || st === "failed") {
    return "call_ended";
  }
  const hc = (input.humanCallStatus || "").toLowerCase();
  if (hc === "ringing" || st === "ringing") return "ringing";
  if (input.screeningPending || input.answerClassification === "screener") {
    return input.screeningPending ? "waiting_for_recipient" : "screening_detected";
  }
  if (input.answerClassification === "human") return "human_connected";
  if (
    input.answerClassification === "voicemail" ||
    input.answerClassification === "machine" ||
    input.answerClassification === "fax"
  ) {
    return "voicemail";
  }
  if (hc === "in_progress" || st === "answered") {
    return input.answerClassification ? "checking_answer" : "answer_detected";
  }
  return "dialing";
}

function isConnectionPhase(v: string): boolean {
  return [
    "dialing",
    "ringing",
    "answer_detected",
    "checking_answer",
    "screening_detected",
    "waiting_for_recipient",
    "human_connected",
    "voicemail",
    "screening_declined",
    "call_ended",
  ].includes(v);
}

export function connectionPhaseLabel(phase: ConnectionPhase): string {
  switch (phase) {
    case "dialing":
      return "Dialing";
    case "ringing":
      return "Ringing";
    case "answer_detected":
      return "Answer detected";
    case "checking_answer":
      return "Checking answer";
    case "screening_detected":
      return "Call screening detected";
    case "waiting_for_recipient":
      return "Call screening detected. Waiting for the recipient to accept.";
    case "human_connected":
      return "Human connected";
    case "voicemail":
      return "Voicemail";
    case "screening_declined":
      return "Screening declined or timed out";
    case "call_ended":
      return "Call ended";
    default:
      return "Dialing";
  }
}
