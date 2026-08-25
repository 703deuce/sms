import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";

/** Configurable qualification workflow — tenant-driven, not industry-specific. */
export type QualificationFieldDefinition = RuntimeFieldManifestEntry;

/** Static business profile for outbound calls (config-driven, not hardcoded in agent code). */
export type OutboundBusinessProfile = {
  name: string;
  description: string;
  services?: string[];
  serviceAreas?: string[];
  /** Optional category labels (e.g. property types, service lines). */
  propertyTypes?: string[];
  phone?: string;
  website?: string;
  /** Authoritative facts for business Q&A when RAG has no hit. */
  knowledgeNotes?: string[];
  /** Optional explicit Q&A pairs for business questions during qualification. */
  qaPairs?: Array<{ question: string; answer: string }>;
};

/** Why this outbound campaign is calling and what the lead already established. */
export type OutboundCampaignProfile = {
  type: string;
  source?: string;
  reasonForContact: string;
  offerOrInterest?: string;
  callerExplanation: string;
  /** When set, do not ask buyer vs seller etc. */
  establishedIntent?: string;
  /** Field ids already satisfied by lead submission — skip unless clarification needed. */
  skipFieldIds?: string[];
};

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
  /** Spoken intro template — supports {leadName}, {businessName}, {reason}, {agentDisplayName} */
  introTemplate?: string;
  /** Spoken close template — supports {leadName}, {businessName}, {agentDisplayName} */
  closeTemplate?: string;
  reasonForContact: string;
  /** Display name for the voice agent (e.g. Amy). */
  agentDisplayName?: string;
  business?: OutboundBusinessProfile;
  campaign?: OutboundCampaignProfile;
  /** Semantic opening elements — not a verbatim script. */
  openingGuidance?: string | string[];
  /** Caller-facing rules: no MLS invention, no mortgage qualification language, etc. */
  authorityBoundaries?: string[];
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
  /** Values already captured from web form / CRM before the call. */
  submittedFields?: Record<string, string>;
  /** High-level intent when known (e.g. home buying). */
  intent?: string | null;
  submittedAt?: string | null;
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
  /** Per-call OpenAI Realtime native voice override (marin, coral, etc.). */
  realtimeVoice?: string;
};

export type OutboundCallStartResult = {
  callId: string;
  roomName: string;
  dispatchId: string | null;
  status: "dispatching" | "failed";
  error?: string;
};
