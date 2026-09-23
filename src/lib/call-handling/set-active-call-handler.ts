import "server-only";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { routePhoneToVoiceV3BasicCallControl } from "@/lib/voice-v3/provisioning/route-phone-to-voice-v3-basic";
import { clearMctbTexmlIngressLockMetadataForVoiceAgent } from "@/lib/voice/mctb-voice-agent-phone-takeover";
import { mergeCallHandlingIntoSettings, readCallHandlingBlock } from "./phone-settings";
import { resolveEffectiveCallHandler } from "./effective-handler";
import {
  assessAiReceptionistCallHandlingReadiness,
  assessMctbCallHandlingReadiness,
} from "./readiness";
import {
  loadCanonicalVoiceIngressPhone,
  resolveCanonicalVoiceIngressPhoneNumberId,
} from "./resolve-canonical-voice-ingress";
import { resolveAiReceptionistForCallHandling } from "./resolve-ai-receptionist";
import { withCallHandlingSwitchLock } from "./switch-lock";
import type { ActiveCallHandler, CallHandlingOwnershipState } from "./types";

const switchingPhones = new Set<string>();

async function readLiveConnectionId(providerNumberId: string): Promise<string | null> {
  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  return String(verify.data?.connection_id || "") || null;
}

async function restoreLiveConnectionId(
  providerNumberId: string,
  connectionId: string,
  e164?: string | null,
): Promise<void> {
  if (!connectionId) return;
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });
  if (e164) {
    const { invalidateMctbTexmlIngressCache } = await import(
      "@/lib/mctb/texml-ingress/config-cache"
    );
    invalidateMctbTexmlIngressCache(e164);
  }
}

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

  let effective: ActiveCallHandler | null = null;
  if (phone.e164 && phone.providerNumberId) {
    effective = await resolveEffectiveCallHandler({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
    });
  }

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

  const selected = block.activeCallHandler;
  const drift =
    explicit &&
    selected !== null &&
    effective !== null &&
    selected !== effective;

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
      ? "Call handling selection does not match live phone routing. Try switching again."
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

export async function setActiveCallHandler(input: {
  workspaceId: string;
  voiceIngressPhoneNumberId?: string | null;
  /** @deprecated use voiceIngressPhoneNumberId */
  phoneNumberId?: string | null;
  handler: ActiveCallHandler;
  userId?: string | null;
}): Promise<CallHandlingOwnershipState> {
  const voiceIngressPhoneNumberId = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: input.workspaceId,
    voiceIngressPhoneNumberId: input.voiceIngressPhoneNumberId ?? input.phoneNumberId,
  });
  if (!voiceIngressPhoneNumberId) {
    throw new Error("No canonical voice ingress number is configured for this workspace.");
  }

  return withCallHandlingSwitchLock(voiceIngressPhoneNumberId, async () => {
    switchingPhones.add(voiceIngressPhoneNumberId);
    try {
      const phone = await loadCanonicalVoiceIngressPhone({
        workspaceId: input.workspaceId,
        voiceIngressPhoneNumberId,
      });
      if (!phone?.e164 || !phone.providerNumberId) {
        throw new Error("Voice ingress number is missing provider routing identifiers.");
      }

      const priorConnectionId = await readLiveConnectionId(phone.providerNumberId);
      const block = readCallHandlingBlock(phone.settingsJson);

      if (block.activeCallHandler === input.handler && block.explicitSelectionAt) {
        const effective = await resolveEffectiveCallHandler({
          e164: phone.e164,
          providerNumberId: phone.providerNumberId,
        });
        if (effective === input.handler) {
          const state = await loadCallHandlingOwnershipState({
            workspaceId: input.workspaceId,
            voiceIngressPhoneNumberId: phone.id,
          });
          if (state) return state;
        }
      }

      if (input.handler === "mctb") {
        const readiness = await assessMctbCallHandlingReadiness({
          workspaceId: input.workspaceId,
          voiceIngressPhoneNumberId: phone.id,
        });
        if (!readiness.ready) {
          throw new Error(readiness.message || "MCTB is not ready for call handling.");
        }

        const aiForPark = await resolveAiReceptionistForCallHandling({
          workspaceId: input.workspaceId,
          preferredAgentId: block.parkedAiReceptionistAgentId,
        });
        const parkedId =
          block.parkedAiReceptionistAgentId || aiForPark?.agentId || null;

        await routePhoneToMctbCallHandlingIngress({
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
        });

        const settings = mergeCallHandlingIntoSettings(phone.settingsJson, {
          activeCallHandler: "mctb",
          parkedAiReceptionistAgentId: parkedId,
          explicitSelectionAt: new Date().toISOString(),
          lastSwitchAt: new Date().toISOString(),
          lastSwitchByUserId: input.userId ?? null,
        });
        await getPrisma().phoneNumber.update({
          where: { id: phone.id },
          data: { settingsJson: settings as object },
        });
      } else {
        const readiness = await assessAiReceptionistCallHandlingReadiness({
          workspaceId: input.workspaceId,
          preferredAgentId: block.parkedAiReceptionistAgentId,
        });
        if (!readiness.ready || !readiness.agentId) {
          throw new Error(
            readiness.message ||
              "AI Receptionist isn't ready yet. Finish setup before switching call handling.",
          );
        }

        const route = await routePhoneToVoiceV3BasicCallControl({
          e164: phone.e164,
          providerNumberId: phone.providerNumberId,
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
        });
        if (!route.matched) {
          throw new Error("Voice routing did not match the live voice ingress connection.");
        }

        await clearMctbTexmlIngressLockMetadataForVoiceAgent({
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
        });

        const refreshed = await getPrisma().phoneNumber.findFirst({
          where: { id: phone.id, workspaceId: input.workspaceId },
          select: { settingsJson: true },
        });
        const settings = mergeCallHandlingIntoSettings(refreshed?.settingsJson ?? phone.settingsJson, {
          activeCallHandler: "ai_receptionist",
          parkedAiReceptionistAgentId: readiness.agentId,
          explicitSelectionAt: new Date().toISOString(),
          lastSwitchAt: new Date().toISOString(),
          lastSwitchByUserId: input.userId ?? null,
        });
        await getPrisma().phoneNumber.update({
          where: { id: phone.id },
          data: { settingsJson: settings as object },
        });
      }

      const effective = await resolveEffectiveCallHandler({
        e164: phone.e164,
        providerNumberId: phone.providerNumberId,
      });
      if (effective !== input.handler) {
        if (priorConnectionId) {
          await restoreLiveConnectionId(
            phone.providerNumberId,
            priorConnectionId,
            phone.e164,
          ).catch(() => undefined);
        }
        throw new Error("Provider routing verification failed after switch.");
      }

      console.log("CALL_HANDLING_SWITCH_OK", {
        workspaceId: input.workspaceId,
        voiceIngressPhoneNumberId: phone.id,
        handler: input.handler,
        userId: input.userId ?? null,
        priorConnectionId,
      });

      const state = await loadCallHandlingOwnershipState({
        workspaceId: input.workspaceId,
        voiceIngressPhoneNumberId: phone.id,
      });
      if (!state) throw new Error("Could not load call handling state.");
      return state;
    } catch (err) {
      console.warn("CALL_HANDLING_SWITCH_FAIL", {
        workspaceId: input.workspaceId,
        voiceIngressPhoneNumberId,
        handler: input.handler,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      switchingPhones.delete(voiceIngressPhoneNumberId);
    }
  });
}
