import "server-only";

import type { VoiceV2CallContext } from "../intake/types";
import type {
  VoiceV2CallContextRecord,
  VoiceV2ContextCapabilities,
  VoiceV2ContextIdentity,
  VoiceV2EnrollmentSnapshot,
} from "./types";
import { VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION } from "./types";

export function projectOfferFromLegacy(ctx: VoiceV2CallContext): VoiceV2CallContextRecord["booking"] {
  const timezone = ctx.businessTimezone;
  const currentOffer = ctx.currentOfferSet
    ? {
        offerSetId: ctx.currentOfferSet.offerSetId,
        selectedSlotId: ctx.bookingState?.selectedSlotId,
        slotIds: ctx.currentOfferSet.slotIds,
      }
    : undefined;
  return {
    timezone,
    stage: ctx.bookingWorkflow?.nextStage,
    currentOffer,
  };
}

export function buildRecordFromLegacy(input: {
  payload: VoiceV2CallContext;
  identity: VoiceV2ContextIdentity;
  enrollment: VoiceV2EnrollmentSnapshot;
  capabilities?: VoiceV2ContextCapabilities;
  stateVersion?: number;
  lifecycleStatus?: "ACTIVE" | "ENDING" | "ENDED";
}): VoiceV2CallContextRecord {
  const now = new Date().toISOString();
  const booking = projectOfferFromLegacy(input.payload);
  return {
    schemaVersion: VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION,
    stateVersion: input.stateVersion ?? 0,
    identity: input.identity,
    enrollment: input.enrollment,
    lifecycle: {
      status: input.lifecycleStatus ?? "ACTIVE",
      createdAt: input.payload.compiledAt || now,
      updatedAt: now,
    },
    capabilities: input.capabilities ?? {
      bookingEnabled: true,
      intakeEnabled: true,
    },
    booking,
    config: {
      configFingerprint:
        (input.enrollment as { configFingerprint?: string }).configFingerprint ||
        undefined,
    },
    payload: input.payload,
  };
}

export function syncLegacyFromRecord(record: VoiceV2CallContextRecord): VoiceV2CallContext {
  const payload = record.payload;
  const offer = record.booking.currentOffer;
  if (offer) {
    payload.currentOfferSet = {
      offerSetId: offer.offerSetId,
      slotIds: offer.slotIds || [],
    };
    if (offer.selectedSlotId) {
      payload.bookingState = { ...payload.bookingState, selectedSlotId: offer.selectedSlotId };
    }
  }
  payload.sessionKey = record.identity.sessionKey;
  payload.workspaceId = record.identity.workspaceId;
  payload.agentId = record.identity.agentId;
  if (record.booking.timezone) payload.businessTimezone = record.booking.timezone;
  payload.capabilities = {
    voiceV2PstnLiveBooking: record.capabilities.voiceV2PstnLiveBooking,
    bookingEnabled: record.capabilities.bookingEnabled,
    intakeEnabled: record.capabilities.intakeEnabled,
  };
  return payload;
}
