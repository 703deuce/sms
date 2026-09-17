import "server-only";

import type { VoiceV2FindAvailabilityResult } from "./types";
import { executeMicrosoft365CertifiedFindAvailability } from "./pipelines/microsoft-365-certified";
import { evaluateFindAvailabilityPreflight } from "./intake/find-availability-preflight";
import { ensureVoiceV2CallContext } from "./intake/load-call-context";
import { patchWorkflowAfterFind } from "./booking-workflow-hooks";

export type PstnMicrosoftFindBlocked = {
  blocked: true;
  status: string;
  speak: string;
};

export type PstnMicrosoftFindResult =
  | PstnMicrosoftFindBlocked
  | { blocked: false; result: VoiceV2FindAvailabilityResult };

export async function preparePstnMicrosoftFind(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  conversationId?: string | null;
  fromE164?: string | null;
  requestedDate?: unknown;
}): Promise<PstnMicrosoftFindBlocked | null> {
  await ensureVoiceV2CallContext({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.callId,
    conversationId: input.conversationId,
    fromE164: input.fromE164,
  }).catch(() => undefined);

  const preflight = await evaluateFindAvailabilityPreflight({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.callId,
    conversationId: input.conversationId,
    fromE164: input.fromE164,
    requestedDate: input.requestedDate,
  });
  if (!preflight.allowed) {
    return { blocked: true, status: preflight.status, speak: preflight.speak };
  }
  return null;
}

export async function executePstnMicrosoftFindWithPeripheral(
  raw: Record<string, unknown>,
  workspaceId: string,
  input: {
    agentId: string;
    callId: string;
    conversationId?: string | null;
    fromE164?: string | null;
    requestedDate?: unknown;
  },
): Promise<PstnMicrosoftFindResult> {
  const blocked = await preparePstnMicrosoftFind({
    workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    conversationId: input.conversationId,
    fromE164: input.fromE164,
    requestedDate: input.requestedDate,
  });
  if (blocked) return blocked;

  const result = await executeMicrosoft365CertifiedFindAvailability(
    { ...raw, call_id: input.callId },
    workspaceId,
    { voiceCallId: input.callId },
  );

  if (result.status === "AVAILABILITY_FOUND" && input.agentId) {
    const requestedDate = String(input.requestedDate ?? "");
    await patchWorkflowAfterFind({
      workspaceId,
      agentId: input.agentId,
      callControlId: input.callId,
      conversationId: input.conversationId,
      requestedDate,
      offerSetId: result.offer_set_id,
      slotIds: result.slots.map((s) => s.slot_id),
    }).catch(() => undefined);
  }

  return { blocked: false, result };
}
