import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import {
  defaultVoiceV2DialogState,
  dialogFromContext,
  isActiveBookingGoal,
  type VoiceDialogGoal,
  type VoiceV2DialogState,
} from "./dialog-goal";
import { mergeWorkflowIntoContext, workflowFromContext } from "./booking-workflow";
import { setVoiceV2CallContext, getVoiceV2CallContext } from "./intake/session-store";
import {
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "./session/call-context-store";

export type DialogMutationInput = {
  activeGoal?: VoiceDialogGoal;
  confidence?: number;
  explicit?: boolean;
  evidence?: string | null;
  evidenceSpeaker?: "caller";
  schedulingHints?: VoiceV2DialogState["schedulingHints"];
  explicitCallbackRequested?: boolean;
};

/** Resolve authoritative context for Live (canonical call: + cc: aliases). */
export async function loadAuthoritativeCallContextForLive(input: {
  workspaceId: string;
  agentId: string;
  callControlId: string;
  prismaCallId: string;
}): Promise<VoiceV2CallContext | null> {
  const canonical = await resolveVoiceV2SessionKey({
    callId: input.prismaCallId,
    callControlId: input.callControlId,
    conversationId: input.callControlId,
  });
  const lookupKeys = [
    canonical,
    `call:${input.prismaCallId}`,
    `cc:${input.callControlId}`,
  ].filter(Boolean) as string[];

  for (const key of lookupKeys) {
    const sync = getVoiceV2CallContext(key);
    if (sync) return sync;
    const fromL2 = await loadVoiceV2CallContext(key);
    if (fromL2) return fromL2;
  }
  return null;
}

export function mergeDialogState(
  ctx: VoiceV2CallContext,
  mutation: DialogMutationInput,
): { ctx: VoiceV2CallContext; dialog: VoiceV2DialogState; changed: boolean } {
  const prior = dialogFromContext(ctx);
  const next: VoiceV2DialogState = {
    ...prior,
    updatedAt: new Date().toISOString(),
    workflowCycleId: prior.workflowCycleId ?? 1,
  };

  if (mutation.activeGoal !== undefined) {
    next.activeGoal = mutation.activeGoal;
  }
  if (mutation.confidence !== undefined) next.confidence = mutation.confidence;
  if (mutation.explicit !== undefined) next.explicit = mutation.explicit;
  if (mutation.evidence !== undefined) next.lastIntentEvidence = mutation.evidence;
  if (mutation.evidenceSpeaker) next.evidenceSpeaker = mutation.evidenceSpeaker;
  if (mutation.schedulingHints) {
    next.schedulingHints = { ...(prior.schedulingHints ?? {}), ...mutation.schedulingHints };
  }
  if (mutation.explicitCallbackRequested === true) {
    next.explicitCallbackRequested = true;
  }

  let workflow = workflowFromContext(ctx);
  if (isActiveBookingGoal(next.activeGoal)) {
    workflow = { ...workflow, bookingIntentActive: true };
  }

  const changed =
    prior.activeGoal !== next.activeGoal ||
    prior.lastIntentEvidence !== next.lastIntentEvidence ||
    JSON.stringify(prior.schedulingHints ?? {}) !== JSON.stringify(next.schedulingHints ?? {});

  const merged = mergeWorkflowIntoContext({ ...ctx, dialog: next }, workflow);
  return { ctx: merged, dialog: next, changed };
}

/** Persist dialog + workflow into L1 (all aliases) and async L2. */
export function persistCallContext(ctx: VoiceV2CallContext): void {
  setVoiceV2CallContext(ctx);
}

export function logDialogStateChanged(fields: Record<string, unknown>) {
  console.info(`VOICE_DIALOG_STATE_CHANGED ${JSON.stringify(fields)}`);
}
