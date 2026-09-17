import type { VoiceV2NextStage } from "./booking-workflow";
import {
  allowedNextActionsForStage,
  deriveRequiredActionForStage,
  normalizeRequestedDate,
  workflowFromContext,
} from "./booking-workflow";
import { getIntakeReadiness } from "./intake/readiness";
import type { VoiceV2CallContext } from "./intake/types";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_CANCEL_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_FIND_EXISTING_TOOL_TYPE,
  VOICE_V2_RESCHEDULE_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
} from "./telnyx-tool-definition";
import { effectiveRequestedDate } from "./scheduling-preference-state";
import { loadVoiceV2OfferSet } from "./offer-set-store";

export type LiveToolCategory = "FACT_CAPTURE" | "READ_LOOKUP" | "SIDE_EFFECT" | "COMMUNICATION";

export type ToolExecutionContract = {
  name: string;
  category: LiveToolCategory;
  autoDispatchEligible: boolean;
  canRun(ctx: VoiceV2CallContext, stage: VoiceV2NextStage): boolean;
  missingRequirements(ctx: VoiceV2CallContext, stage: VoiceV2NextStage): string[];
  buildArgs(ctx: VoiceV2CallContext): Record<string, unknown>;
};

export const LIVE_TOOL_REGISTRY_NAMES = [
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_EXISTING_TOOL_TYPE,
  VOICE_V2_RESCHEDULE_TOOL_TYPE,
  VOICE_V2_CANCEL_TOOL_TYPE,
] as const;

function stageAllowsTool(stage: VoiceV2NextStage, toolName: string): boolean {
  const allowed = allowedNextActionsForStage(stage);
  const action = toolName;
  return allowed.includes(action);
}

function buildFindArgs(ctx: VoiceV2CallContext): Record<string, unknown> {
  const date =
    effectiveRequestedDate(ctx) ||
    normalizeRequestedDate(ctx.schedulingPreference?.requestedDate);
  return {
    requested_date: date ?? undefined,
    tool_invocation_id: `auto_find_${ctx.sessionKey}`,
  };
}

function buildBookArgs(ctx: VoiceV2CallContext): Record<string, unknown> {
  const offerSetId = ctx.currentOfferSet?.offerSetId ?? "";
  const slotId = ctx.bookingState?.selectedSlotId ?? "";
  return {
    offer_set_id: offerSetId,
    selected_slot_id: slotId,
    tool_invocation_id: `auto_book_${ctx.sessionKey}`,
  };
}

export const LIVE_TOOL_REGISTRY: Record<string, ToolExecutionContract> = {
  [VOICE_V2_SAVE_INTAKE_TOOL_TYPE]: {
    name: VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
    category: "FACT_CAPTURE",
    autoDispatchEligible: false,
    canRun: () => false,
    missingRequirements: () => ["save_is_model_or_batch_path"],
    buildArgs: () => ({}),
  },
  [VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE]: {
    name: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    category: "READ_LOOKUP",
    autoDispatchEligible: true,
    canRun(ctx, stage) {
      if (stage !== "FIND_AVAILABILITY") return false;
      const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
      if (readiness.missingBeforeBooking.length > 0) return false;
      const date = effectiveRequestedDate(ctx);
      if (!date) return false;
      const offer = ctx.currentOfferSet;
      if (offer?.offerSetId && (offer.slotIds?.length ?? 0) > 0) {
        const wf = workflowFromContext(ctx);
        if (wf.lastFindRequestedDate === date || wf.requestedDate === date) return false;
      }
      return true;
    },
    missingRequirements(ctx) {
      const missing: string[] = [];
      const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
      if (readiness.missingBeforeBooking.length) {
        missing.push(`intake:${readiness.missingBeforeBooking.join(",")}`);
      }
      if (!effectiveRequestedDate(ctx)) missing.push("requested_date");
      return missing;
    },
    buildArgs: buildFindArgs,
  },
  [VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE]: {
    name: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: true,
    canRun(ctx, stage) {
      if (stage !== "BOOK_SELECTED_SLOT") return false;
      if (!ctx.currentOfferSet?.offerSetId) return false;
      if (!ctx.bookingState?.selectedSlotId) return false;
      if (ctx.bookingWorkflow?.bookingConfirmed) return false;
      return true;
    },
    missingRequirements(ctx) {
      const missing: string[] = [];
      if (!ctx.currentOfferSet?.offerSetId) missing.push("offer_set_id");
      if (!ctx.bookingState?.selectedSlotId) missing.push("selected_slot_id");
      return missing;
    },
    buildArgs: buildBookArgs,
  },
  [VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE]: {
    name: VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: false,
    canRun(ctx, stage) {
      return stage === "FINALIZE_CALLER_REQUEST" && stageAllowsTool(stage, "voice_v2_finalize_caller_request");
    },
    missingRequirements: () => [],
    buildArgs: (ctx) => ({ tool_invocation_id: `auto_finalize_${ctx.sessionKey}` }),
  },
  [VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE]: {
    name: VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: false,
    canRun: (ctx, stage) => stage === "SEND_BOOKING_LINK",
    missingRequirements: () => [],
    buildArgs: (ctx) => ({ tool_invocation_id: `auto_link_${ctx.sessionKey}` }),
  },
  [VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE]: {
    name: VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
    category: "READ_LOOKUP",
    autoDispatchEligible: false,
    canRun: () => true,
    missingRequirements: () => ["query_from_model"],
    buildArgs: () => ({}),
  },
  [VOICE_V2_TRANSFER_CALL_TOOL_TYPE]: {
    name: VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
    category: "COMMUNICATION",
    autoDispatchEligible: false,
    canRun: () => false,
    missingRequirements: () => ["caller_explicit_transfer"],
    buildArgs: () => ({}),
  },
  [VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE]: {
    name: VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: false,
    canRun: (ctx, stage) => stage === "CALLBACK_REQUESTED",
    missingRequirements: () => ["callback_fields"],
    buildArgs: (ctx) => ({ tool_invocation_id: `auto_callback_${ctx.sessionKey}` }),
  },
  [VOICE_V2_FIND_EXISTING_TOOL_TYPE]: {
    name: VOICE_V2_FIND_EXISTING_TOOL_TYPE,
    category: "READ_LOOKUP",
    autoDispatchEligible: false,
    canRun: () => false,
    missingRequirements: () => ["appointment_change_flow"],
    buildArgs: () => ({}),
  },
  [VOICE_V2_RESCHEDULE_TOOL_TYPE]: {
    name: VOICE_V2_RESCHEDULE_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: false,
    canRun: () => false,
    missingRequirements: () => ["reschedule_flow"],
    buildArgs: () => ({}),
  },
  [VOICE_V2_CANCEL_TOOL_TYPE]: {
    name: VOICE_V2_CANCEL_TOOL_TYPE,
    category: "SIDE_EFFECT",
    autoDispatchEligible: false,
    canRun: () => false,
    missingRequirements: () => ["cancel_flow"],
    buildArgs: () => ({}),
  },
};

export function deriveForbiddenToolActions(allowedActions: string[]): string[] {
  const allowed = new Set(allowedActions);
  return LIVE_TOOL_REGISTRY_NAMES.filter((name) => {
    const action = name;
    return !allowed.has(action);
  });
}

export function resolveRequiredActionForContext(
  ctx: VoiceV2CallContext,
  stage: VoiceV2NextStage,
  input: {
    voiceV2PstnLiveBooking: boolean;
    hasActiveOfferSet: boolean;
  },
): string | null {
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const workflow = workflowFromContext(ctx);
  const knownDate = effectiveRequestedDate(ctx, workflow);
  const fromStage = deriveRequiredActionForStage(stage, workflow, readiness, {
    hasActiveOfferSet: input.hasActiveOfferSet,
    knownRequestedDate: knownDate,
  });
  if (fromStage) return fromStage;
  const bookContract = LIVE_TOOL_REGISTRY[VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE];
  if (bookContract.canRun(ctx, stage)) {
    return VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE;
  }
  return null;
}

export function getRegistryEntry(toolName: string): ToolExecutionContract | undefined {
  return LIVE_TOOL_REGISTRY[toolName];
}

/** Async slot validation when offer set is in remote store (auto-dispatch guard). */
export async function validateBookArgsAgainstOfferSet(
  workspaceId: string,
  ctx: VoiceV2CallContext,
): Promise<boolean> {
  const offerId = ctx.currentOfferSet?.offerSetId;
  const slotId = ctx.bookingState?.selectedSlotId;
  if (!offerId || !slotId) return false;
  const loaded = await loadVoiceV2OfferSet(workspaceId, offerId);
  if (!loaded?.slots?.length) return false;
  return loaded.slots.some((s) => s.slot_id === slotId);
}
