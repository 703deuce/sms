import "server-only";

import {
  readCallHandlingBlock,
  resolvePersistedEffectiveCallHandler,
} from "./phone-settings";
import {
  assessAiReceptionistCallHandlingReadiness,
  assessMctbCallHandlingReadiness,
} from "./readiness";
import {
  loadCanonicalVoiceIngressPhone,
  resolveCanonicalVoiceIngressPhoneNumberId,
} from "./resolve-canonical-voice-ingress";
import type { CallHandlingOwnershipState } from "./types";

const switchingPhones = new Set<string>();

export function markCallHandlingSwitching(phoneId: string, on: boolean): void {
  if (on) switchingPhones.add(phoneId);
  else switchingPhones.delete(phoneId);
}

/** Read path: persisted Transovo state + local DB readiness only (no Telnyx). */
export async function loadCallHandlingOwnershipState(input: {
  workspaceId: string;
  voiceIngressPhoneNumberId?: string | null;
  /** @deprecated use voiceIngressPhoneNumberId */
  phoneNumberId?: string | null;
}): Promise<CallHandlingOwnershipState | null> {
  const voiceIngressPhoneNumberId = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: input.workspaceId,
    voiceIngressPhoneNumberId: input.voiceIngressPhoneNumberId ?? input.phoneNumberId,
  });
  if (!voiceIngressPhoneNumberId) return null;

  const phone = await loadCanonicalVoiceIngressPhone({
    workspaceId: input.workspaceId,
    voiceIngressPhoneNumberId,
  });
  if (!phone) return null;

  const block = readCallHandlingBlock(phone.settingsJson);
  const explicit = Boolean(block.explicitSelectionAt && block.activeCallHandler);
  const selected = block.activeCallHandler;
  const effective = resolvePersistedEffectiveCallHandler(block);
  const drift = block.routingDrift === true;

  const [mctbReady, aiReady] = await Promise.all([
    assessMctbCallHandlingReadiness({
      workspaceId: input.workspaceId,
      voiceIngressPhoneNumberId: phone.id,
    }),
    assessAiReceptionistCallHandlingReadiness({
      workspaceId: input.workspaceId,
      preferredAgentId: block.parkedAiReceptionistAgentId,
    }),
  ]);

  return {
    voiceIngressPhoneNumberId: phone.id,
    phoneNumberId: phone.id,
    voiceIngressE164: phone.e164,
    e164: phone.e164,
    selectedHandler: selected,
    explicitSelection: explicit,
    effectiveHandler: effective,
    drift,
    switching: switchingPhones.has(phone.id),
    error: drift
      ? "Call handling selection does not match live phone routing. Try switching again or reconnect."
      : null,
    aiReceptionist: {
      agentId: aiReady.agentId ?? block.parkedAiReceptionistAgentId ?? null,
      aiVoicePhoneNumberId: aiReady.aiVoicePhoneNumberId,
      ready: aiReady.ready,
      readinessMessage: aiReady.message,
    },
    mctb: {
      ready: mctbReady.ready,
      readinessMessage: mctbReady.message,
    },
  };
}
