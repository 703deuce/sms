import type { VoiceV2CallContext } from "../intake/types";
import { resolveVoiceV2PrimaryOutcome } from "../primary-outcome";
import { buildPinnedSchemaSnapshot } from "./pinned-schema-snapshot";
import type { VoiceV2RecoveryStructuredState, VoiceV2ResolutionStatus } from "./types";

function intakeFieldsToMap(ctx: VoiceV2CallContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, row] of Object.entries(ctx.intakeState)) {
    if (row?.value?.trim()) out[key] = row.value.trim();
  }
  return out;
}

export function buildVoiceV2RecoveryStructuredState(input: {
  ctx: VoiceV2CallContext;
  resolutionStatus: VoiceV2ResolutionStatus;
  recoverySubtype?: string;
}): VoiceV2RecoveryStructuredState {
  const ctx = input.ctx;
  const all = intakeFieldsToMap(ctx);
  const builtin = new Set([
    "name",
    "full_name",
    "phone",
    "email",
    "address",
    "service_reason",
    "scheduling_preference",
  ]);
  const customFields: Record<string, string> = {};
  const callerFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) {
    if (builtin.has(k)) callerFields[k] = v;
    else customFields[k] = v;
  }

  const strategy = ctx.capabilities?.bookingStrategy;
  return {
    primaryOutcome: resolveVoiceV2PrimaryOutcome(ctx),
    resolutionStatus: input.resolutionStatus,
    recoverySubtype: input.recoverySubtype as VoiceV2RecoveryStructuredState["recoverySubtype"],
    callerFields,
    customFields,
    qualificationStatus: ctx.qualification?.status,
    urgencyStatus: ctx.afterHours?.urgency?.status,
    schedulingPreference: ctx.bookingWorkflow?.requestedDate
      ? { requestedDate: ctx.bookingWorkflow.requestedDate }
      : undefined,
    booking: {
      provider: ctx.bookingState?.status ? strategy : undefined,
      strategy,
      offerSetId: ctx.currentOfferSet?.offerSetId,
      selectedSlotId: ctx.bookingState?.selectedSlotId,
      bookingStatus: ctx.bookingWorkflow?.bookingConfirmed
        ? "CONFIRMED"
        : ctx.bookingState?.selectedSlotId
          ? "PENDING"
          : undefined,
    },
    transferState: ctx.afterHours?.transfer
      ? { status: ctx.afterHours.transfer.status, reason: ctx.afterHours.transfer.reason }
      : undefined,
    callbackState: ctx.afterHours?.callback
      ? {
          requested: ctx.afterHours.callback.requested,
          success: Boolean(ctx.afterHours.callback.finalizedAt),
        }
      : undefined,
    unresolvedAction: ctx.bookingWorkflow?.nextStage,
    configRevision: ctx.capabilities?.intakeSchemaRevision,
    pinnedSchema: buildPinnedSchemaSnapshot(ctx),
  };
}
