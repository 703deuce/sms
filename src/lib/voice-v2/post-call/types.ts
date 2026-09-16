import type { IntakeFieldKey, VoiceV2IntakeSchema, VoiceV2IntakeState } from "../intake/types";

export type VoiceV2PostCallTranscriptionStatus =
  | "PENDING"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED"
  | "RECORDING_UNAVAILABLE";

export type VoiceV2FieldReconcileVerdict = "MATCH" | "CORRECT" | "REVIEW" | "MISSING";

export type VoiceV2PostCallFieldCandidate = {
  fieldKey: IntakeFieldKey;
  candidateValue?: string;
  verdict: "FOUND" | "NOT_FOUND" | "AMBIGUOUS";
  evidence?: string;
  confidence?: number;
  source: "POST_CALL_TRANSCRIPT";
  channel?: "caller" | "agent" | "mixed";
  isExplicitCorrection?: boolean;
};

export type VoiceV2PostCallReconcileFieldResult = {
  fieldKey: IntakeFieldKey;
  liveValue?: string;
  reconciledValue?: string;
  verdict: VoiceV2FieldReconcileVerdict;
  previousValue?: string;
  provenance?: string;
};

export type VoiceV2PostCallReconcileOutput = {
  fields: VoiceV2PostCallReconcileFieldResult[];
  reconciledIntake: VoiceV2IntakeState;
  recordComplete: boolean;
  missingForRecord: IntakeFieldKey[];
  needsReview: boolean;
};

export type VoiceV2PinnedIntakeSnapshot = {
  intakeSchema: VoiceV2IntakeSchema;
  intakeState: VoiceV2IntakeState;
  intakeSchemaRevision?: string;
  callerAniE164?: string | null;
  primaryOutcome?: string;
};

export type VoiceV2MultichannelTranscript = {
  provider: "deepgram";
  model: string;
  fullText: string;
  callerText: string;
  agentText: string;
  requestId?: string;
  raw?: unknown;
};
