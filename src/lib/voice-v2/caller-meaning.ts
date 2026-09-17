import type { VoiceDialogGoal } from "./dialog-goal";

/** Canonical semantic output — all interpreters must return this shape. */
export type CallerMeaningFacts = {
  requested_date?: string | null;
  requested_daypart?: string | null;
  requested_time?: string | null;
};

export type CallerMeaning = {
  active_goal: VoiceDialogGoal;
  facts: CallerMeaningFacts;
  corrections: string[];
  explicit_action_requests: string[];
  ambiguities: string[];
  confidence: number;
  digression: boolean;
  /** Caller utterance evidence (normalized stable text). */
  evidence: string;
};

export type StableUtteranceRef = {
  utterance_id: string;
  revision: number;
  start_ms: number;
  end_ms: number;
  stable_at: number;
  text: string;
};

export type InterpreterContext = {
  priorActiveGoal: VoiceDialogGoal;
  businessTimezone: string;
  stable: StableUtteranceRef;
  callId?: string;
};

export type CallerInterpretationResult = {
  meaning: CallerMeaning;
  /** Observability only — downstream must not branch on this. */
  implementationId: string;
  latencyMs: number;
  fallbackReason?: string;
};

export interface CallerInterpreter {
  readonly implementationId: string;
  interpret(input: InterpreterContext): Promise<CallerInterpretationResult | null>;
}
