import "server-only";

import type { VoiceV2CallContext } from "../intake/types";

/** Shape of persisted Voice V2 session (L2). schemaVersion ≠ stateVersion. */
export const VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION = 1;

/** 4h — matches amy realtime session; covers long calls + short recovery window. */
export const VOICE_V2_CALL_CONTEXT_TTL_SEC = 4 * 60 * 60;

export type VoiceV2ContextLifecycleStatus = "ACTIVE" | "ENDING" | "ENDED";

export type VoiceV2WriteClass = "A" | "B";

export type VoiceV2ContextIdentity = {
  sessionKey: string;
  callId: string;
  workspaceId: string;
  agentId: string;
  telnyxCallControlId?: string;
  telnyxConversationId?: string;
};

export type VoiceV2EnrollmentSnapshot = {
  publishedConfigRevision?: string;
  businessKnowledgeRevision?: string;
  agentRevision?: string;
  providerConfigRevision?: string;
  enrolledAt: string;
  /** When true revision fields were unavailable at enroll time. */
  revisionGaps?: string[];
};

export type VoiceV2ContextLifecycle = {
  status: VoiceV2ContextLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};

export type VoiceV2ContextCapabilities = {
  bookingEnabled: boolean;
  intakeEnabled: boolean;
  transferEnabled?: boolean;
  /** Pinned at enrollment/warmup — do not reload agent config per tool. */
  voiceV2PstnLiveBooking?: boolean;
  /** Wizard-published mode — pinned for entire call. */
  bookingStrategy?: import("../booking-strategy").VoiceV2BookingStrategy;
};

export type VoiceV2BookingPreference = {
  requestedDate?: string;
  requestedTime?: string;
  windowStart?: string;
  windowEnd?: string;
  daypart?: string;
  exclusions?: string[];
  updatedAt?: string;
};

export type VoiceV2CurrentOfferRef = {
  offerSetId: string;
  selectedSlotId?: string;
  expiresAt?: string;
  slotIds?: string[];
};

export type VoiceV2CallContextRecord = {
  schemaVersion: number;
  stateVersion: number;
  identity: VoiceV2ContextIdentity;
  enrollment: VoiceV2EnrollmentSnapshot;
  lifecycle: VoiceV2ContextLifecycle;
  capabilities: VoiceV2ContextCapabilities;
  bookingPreference?: VoiceV2BookingPreference;
  booking: {
    provider?: string;
    connectionId?: string;
    calendarId?: string;
    timezone?: string;
    durationMinutes?: number;
    stage?: string;
    currentOffer?: VoiceV2CurrentOfferRef;
  };
  config: {
    configFingerprint?: string;
  };
  /** Existing runtime shape — single source for intake schema/state/workflow (Phase 2A). */
  payload: VoiceV2CallContext;
};

export type VoiceV2PatchResult =
  | { applied: true; record: VoiceV2CallContextRecord; newVersion: number }
  | { applied: false; reason: "STALE_VERSION"; currentVersion: number }
  | { applied: false; reason: "SESSION_ENDED"; currentVersion: number }
  | { applied: false; reason: "NOT_FOUND" };

export type VoiceV2RecoveryResult =
  | { ok: true; record: VoiceV2CallContextRecord }
  | { ok: false; code: "CALL_CONTEXT_RECOVERY_UNAVAILABLE"; detail?: string };
