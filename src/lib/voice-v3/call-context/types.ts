/**
 * Authoritative per-call business state for Voice V3.
 * Conversation/audio stays on GPT-Live-1 + Astra; this layer holds app truth only.
 */

export type VoiceV3IntakeFieldStatus =
  | "MISSING"
  | "CAPTURED"
  | "CONFIRMED"
  | "CORRECTED";

export type VoiceV3IntakeFieldSource = "CALLER" | "ASTRA_STRUCTURED" | "SYSTEM" | "TOOL";

export interface VoiceV3IntakeFieldValue {
  value: string;
  status: VoiceV3IntakeFieldStatus;
  source: VoiceV3IntakeFieldSource;
  updatedAt: string;
  evidence?: string;
  extractionGeneration?: number;
}

export type VoiceV3IntakeState = Record<string, VoiceV3IntakeFieldValue>;

export interface VoiceV3IntakeFieldDefinition {
  key: string;
  label: string;
  requiredBeforeBooking: boolean;
  requiredForRecord: boolean;
}

export interface VoiceV3BusinessConfig {
  workspaceId: string;
  agentId: string;
  businessTimezone: string;
  intakeFields: VoiceV3IntakeFieldDefinition[];
}

/** Monotonic counters for stale async tool / availability results. */
export interface VoiceV3GenerationCounters {
  extraction: number;
  tool: number;
  availabilitySearch: number;
}

export interface VoiceV3OfferSetRef {
  offerSetId: string;
  slotIds: string[];
  availabilitySearchGeneration: number;
}

export interface VoiceV3CallContext {
  sessionKey: string;
  liveSessionId: string;
  callId?: string | null;
  callerAniE164?: string | null;
  business: VoiceV3BusinessConfig;
  intakeState: VoiceV3IntakeState;
  generations: VoiceV3GenerationCounters;
  currentOfferSet?: VoiceV3OfferSetRef;
  selectedSlotId?: string;
  compiledAt: string;
}

export function createEmptyVoiceV3CallContext(input: {
  sessionKey: string;
  liveSessionId: string;
  callId?: string | null;
  callerAniE164?: string | null;
  business: VoiceV3BusinessConfig;
  now?: Date;
}): VoiceV3CallContext {
  const now = input.now ?? new Date();
  return {
    sessionKey: input.sessionKey,
    liveSessionId: input.liveSessionId,
    callId: input.callId ?? null,
    callerAniE164: input.callerAniE164 ?? null,
    business: input.business,
    intakeState: {},
    generations: {
      extraction: 0,
      tool: 0,
      availabilitySearch: 0,
    },
    compiledAt: now.toISOString(),
  };
}
