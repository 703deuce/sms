import "server-only";

import type { VoiceV2CallContext } from "../intake/types";
import type { VoiceV2ContextCapabilities } from "./types";

/** Pin wizard/runtime capability flags on the L2 record for cross-replica sync. */
export function voiceV2CapabilitiesFromPayload(
  payload: VoiceV2CallContext,
  overrides?: Partial<VoiceV2ContextCapabilities>,
): VoiceV2ContextCapabilities {
  const c = payload.capabilities;
  return {
    bookingEnabled: overrides?.bookingEnabled ?? c?.bookingEnabled ?? true,
    intakeEnabled: overrides?.intakeEnabled ?? c?.intakeEnabled ?? true,
    transferEnabled: overrides?.transferEnabled ?? c?.transferEnabled,
    voiceV2PstnLiveBooking:
      overrides?.voiceV2PstnLiveBooking ?? c?.voiceV2PstnLiveBooking,
    bookingStrategy: overrides?.bookingStrategy ?? c?.bookingStrategy,
    knowledgeBaseEnabled:
      overrides?.knowledgeBaseEnabled ?? c?.knowledgeBaseEnabled,
    knowledgeBaseRevision:
      overrides?.knowledgeBaseRevision ?? c?.knowledgeBaseRevision,
    knowledgeBaseIds: overrides?.knowledgeBaseIds ?? c?.knowledgeBaseIds,
    qualificationEnabled:
      overrides?.qualificationEnabled ?? c?.qualificationEnabled,
    qualificationRequiredBeforePrimaryAction:
      overrides?.qualificationRequiredBeforePrimaryAction ??
      c?.qualificationRequiredBeforePrimaryAction,
    qualificationRevision:
      overrides?.qualificationRevision ?? c?.qualificationRevision,
    qualificationRules: overrides?.qualificationRules ?? c?.qualificationRules,
    qualificationRulesMatchMode:
      overrides?.qualificationRulesMatchMode ?? c?.qualificationRulesMatchMode,
    qualificationSupportedZipCodes:
      overrides?.qualificationSupportedZipCodes ??
      c?.qualificationSupportedZipCodes,
    qualificationNotQualifiedFallback:
      overrides?.qualificationNotQualifiedFallback ??
      c?.qualificationNotQualifiedFallback,
    qualificationNeedsReviewFallback:
      overrides?.qualificationNeedsReviewFallback ??
      c?.qualificationNeedsReviewFallback,
    qualificationFieldKeys:
      overrides?.qualificationFieldKeys ?? c?.qualificationFieldKeys,
  };
}

export function mergePayloadCapabilitiesFromRecord(
  payload: VoiceV2CallContext,
  record: VoiceV2ContextCapabilities,
): void {
  payload.capabilities = {
    ...payload.capabilities,
    voiceV2PstnLiveBooking: record.voiceV2PstnLiveBooking,
    bookingEnabled: record.bookingEnabled,
    intakeEnabled: record.intakeEnabled,
    bookingStrategy: record.bookingStrategy ?? payload.capabilities?.bookingStrategy,
    knowledgeBaseEnabled: record.knowledgeBaseEnabled,
    knowledgeBaseRevision: record.knowledgeBaseRevision,
    knowledgeBaseIds: record.knowledgeBaseIds,
    qualificationEnabled: record.qualificationEnabled,
    qualificationRequiredBeforePrimaryAction:
      record.qualificationRequiredBeforePrimaryAction,
    qualificationRevision: record.qualificationRevision,
    qualificationRules: record.qualificationRules,
    qualificationRulesMatchMode: record.qualificationRulesMatchMode,
    qualificationSupportedZipCodes: record.qualificationSupportedZipCodes,
    qualificationNotQualifiedFallback: record.qualificationNotQualifiedFallback,
    qualificationNeedsReviewFallback: record.qualificationNeedsReviewFallback,
    qualificationFieldKeys: record.qualificationFieldKeys,
  };
}
