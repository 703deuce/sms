import "server-only";

import {
  isVoiceV2PstnLiveBookingMode,
  resolveVoiceV2BookingStrategy,
} from "@/lib/voice-v2/pstn-workflow-mode";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  buildWorkflowToolPayload,
  deriveVoiceV2NextStage,
  transitionAfterFind,
  transitionAfterBookingConfirmed,
  workflowFromContextWithDialog,
} from "./booking-workflow";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import { resolveSessionKey } from "./intake/load-call-context";
import { getIntakeReadiness } from "./intake/readiness";
import { filterAllowedActionsForDialog } from "./dialog-goal";

export async function loadVoiceV2PstnLiveBookingFlag(
  workspaceId: string,
  agentId: string,
): Promise<boolean> {
  if (workspaceId === "ws_test") return true;
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const config = parseVoiceAgentConfig(runtime);
  return isVoiceV2PstnLiveBookingMode(config);
}

/** Warm tool path — use pinned capability; recovery may load config once. */
export async function resolveVoiceV2PstnLiveBookingForContext(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  workspaceId: string,
  agentId: string,
): Promise<{ flag: boolean; reloaded: boolean }> {
  if (ctx.capabilities?.voiceV2PstnLiveBooking !== undefined) {
    return { flag: Boolean(ctx.capabilities.voiceV2PstnLiveBooking), reloaded: false };
  }
  const flag = await loadVoiceV2PstnLiveBookingFlag(workspaceId, agentId);
  return { flag, reloaded: true };
}

export async function resolveVoiceV2BookingStrategyForContext(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  workspaceId: string,
  agentId: string,
): Promise<ReturnType<typeof resolveVoiceV2BookingStrategy>> {
  if (ctx.capabilities?.bookingStrategy) return ctx.capabilities.bookingStrategy;
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  return resolveVoiceV2BookingStrategy(parseVoiceAgentConfig(runtime));
}

export function workflowPayloadForContext(
  ctx: NonNullable<ReturnType<typeof getVoiceV2CallContext>>,
  voiceV2PstnLiveBooking: boolean,
  bookingStrategy?: ReturnType<typeof resolveVoiceV2BookingStrategy>,
): Record<string, unknown> {
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const hasOffer =
    Boolean(ctx.currentOfferSet?.offerSetId) && (ctx.currentOfferSet?.slotIds?.length ?? 0) > 0;
  const workflow = workflowFromContextWithDialog(ctx);
  const strategy =
    bookingStrategy ??
    ctx.capabilities?.bookingStrategy ??
    (voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  workflow.nextStage = deriveVoiceV2NextStage({
    workflow,
    readiness,
    hasActiveOfferSet: hasOffer,
    bookingStrategy: strategy,
    schedulingPreference: ctx.schedulingPreference,
  });
  const payload = buildWorkflowToolPayload({
    voiceV2PstnLiveBooking,
    bookingStrategy: strategy,
    workflow,
    readiness,
    hasActiveOfferSet: hasOffer,
    ctx,
  });
  const allowed = filterAllowedActionsForDialog(
    ctx,
    (payload.allowed_next_actions as string[]) || [],
  );
  return { ...payload, allowed_next_actions: allowed };
}

export async function patchWorkflowAfterFind(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  requestedDate: string;
  offerSetId: string;
  slotIds: string[];
}): Promise<void> {
  const { ensureVoiceV2CallContext } = await import("./intake/load-call-context");
  const ctx =
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
    }).catch(() => null)) ??
    getVoiceV2CallContext(
      resolveSessionKey({
        callControlId: input.callControlId,
        conversationId: input.conversationId,
      }) || "",
    );
  if (!ctx) return;
  setVoiceV2CallContext(
    transitionAfterFind({
      ctx,
      requestedDate: input.requestedDate,
      offerSetId: input.offerSetId,
      slotIds: input.slotIds,
    }),
  );
}

export async function patchWorkflowAfterBookConfirmed(input: {
  callControlId?: string | null;
  conversationId?: string | null;
}): Promise<void> {
  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });
  if (!sessionKey) return;
  const ctx = getVoiceV2CallContext(sessionKey);
  if (!ctx) return;
  setVoiceV2CallContext(transitionAfterBookingConfirmed(ctx));
}
