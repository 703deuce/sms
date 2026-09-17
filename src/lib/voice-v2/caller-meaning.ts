import type { VoiceDialogGoal } from "./dialog-goal";
import type { VoiceV2CallContext } from "./intake/types";
import type { VoiceV2NextStage } from "./booking-workflow";
import type { VoiceV2SchedulingPreference } from "./scheduling-preference-state";
import type { IntakeFieldKey } from "./intake/types";
export type InterpreterMergePolicy = "full" | "literal_facts_only" | "none";

export type InterpreterOfferSlotSummary = {
  slot_id: string;
  label?: string;
  spoken_label?: string;
  sort_index: number;
};

export type CallerMeaningFacts = {
  requested_date?: string | null;
  requested_daypart?: string | null;
  requested_time?: string | null;
  /** Spoken slot label or time ("11", "11 AM") when offer set is active. */
  selected_slot_spoken_label?: string | null;
  /** 1-based ordinal within offered slots ("later one" → resolved downstream). */
  selected_slot_ordinal?: number | null;
  selected_slot_id?: string | null;
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
  /** Safe deterministic fallback only — not from Astra JSON. */
  literal_intake_fields?: Partial<Record<IntakeFieldKey, string>>;
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
  stable: StableUtteranceRef;
  /** Semantic memory — full caller/Amy transcript so far (evidence only). */
  fullConversationTranscript: string;
  /** Authoritative durable state snapshot at interpretation time. */
  callContext: VoiceV2CallContext;
  priorActiveGoal: VoiceDialogGoal;
  activeGoal: VoiceDialogGoal;
  currentWorkflowStage: VoiceV2NextStage;
  businessTimezone: string;
  currentDateTimeIso: string;
  schedulingPreference: VoiceV2SchedulingPreference | null;
  effectiveRequestedDate: string | null;
  currentOfferSet: {
    offer_set_id: string;
    slot_ids: string[];
    offered_slots: InterpreterOfferSlotSummary[];
  } | null;
  acceptedIntakeSnapshot: Record<string, string>;
  callId?: string;
};

export type CallerInterpretationResult = {
  meaning: CallerMeaning;
  /** Observability only — downstream must not branch on this. */
  implementationId: string;
  latencyMs: number;
  fallbackReason?: string;
  mergePolicy: InterpreterMergePolicy;
};

export interface CallerInterpreter {
  readonly implementationId: string;
  interpret(input: InterpreterContext): Promise<CallerInterpretationResult | null>;
}

