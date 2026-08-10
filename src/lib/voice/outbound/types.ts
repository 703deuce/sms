import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";

/** Configurable qualification workflow — tenant-driven, not industry-specific. */
export type QualificationFieldDefinition = RuntimeFieldManifestEntry;

export type QualificationOutcomeRule = {
  outcome: QualificationBusinessOutcome;
  /** All listed field IDs must be present in collected fields. */
  requiredFields?: string[];
  /** At least one must be true in context. */
  requireInterested?: boolean;
};

export type QualificationDefinition = {
  id: string;
  label: string;
  businessName: string;
  /** Spoken intro template — supports {leadName}, {businessName}, {reason} */
  introTemplate?: string;
  reasonForContact: string;
  fields: QualificationFieldDefinition[];
  rules: QualificationOutcomeRule[];
  /** Optional dispositions the LLM may set explicitly. */
  allowedOutcomes: QualificationBusinessOutcome[];
};

export type QualificationBusinessOutcome =
  | "QUALIFIED"
  | "NOT_QUALIFIED"
  | "NOT_INTERESTED"
  | "NURTURE"
  | "HOT"
  | "CALLBACK_REQUESTED"
  | "WRONG_NUMBER"
  | "COMPLETED_INTAKE"
  | "NOT_STARTED";

export type TelephonyOutcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED"
  | "VOICEMAIL";

export type LeadQualificationResult = {
  leadId: string | null;
  contactId: string | null;
  outcome: QualificationBusinessOutcome;
  telephonyOutcome: TelephonyOutcome;
  score?: number | null;
  collectedFields: Record<string, string>;
  summary: string;
  nextAction: string;
  completedAt: string;
};

export type OutboundLeadContext = {
  leadId?: string | null;
  contactId?: string | null;
  leadName?: string | null;
  leadPhone: string;
  leadSource?: string | null;
  reasonForContact?: string | null;
  metadata?: Record<string, unknown>;
};

export type OutboundCallTrigger = {
  source: string;
  reason: string;
  campaignId?: string | null;
  consentRecorded?: boolean;
};

/** Job metadata passed via LiveKit agent dispatch. */
export type OutboundJobMetadata = {
  kind: "outbound_lead_qualification";
  callId: string;
  workspaceId: string;
  agentId: string;
  destinationE164: string;
  callerIdE164: string;
  calleeParticipantIdentity: string;
  lead: OutboundLeadContext;
  trigger: OutboundCallTrigger;
  qualification: QualificationDefinition;
};

export type OutboundCallStartResult = {
  callId: string;
  roomName: string;
  dispatchId: string | null;
  status: "dispatching" | "failed";
  error?: string;
};
