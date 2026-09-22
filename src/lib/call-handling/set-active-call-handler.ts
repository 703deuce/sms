import "server-only";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { routePhoneToVoiceV3BasicCallControl } from "@/lib/voice-v3/provisioning/route-phone-to-voice-v3-basic";
import { syncVoiceAgentPhoneAssignment } from "@/lib/voice/agent-phone";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import { clearMctbTexmlIngressLockMetadataForVoiceAgent } from "@/lib/voice/mctb-voice-agent-phone-takeover";
import { resolveMctbPhoneNumberIdForWorkspace } from "@/lib/mctb/platform-production-routing";
import { mergeCallHandlingIntoSettings, readCallHandlingBlock } from "./phone-settings";
import { resolveEffectiveCallHandler } from "./effective-handler";
import {
  assessAiReceptionistCallHandlingReadiness,
  assessMctbCallHandlingReadiness,
} from "./readiness";
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
  phoneNumberId?: string | null;
}): Promise<CallHandlingOwnershipState | null> {
  const phoneNumberId = await resolveMctbPhoneNumberIdForWorkspace({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
  if (!phoneNumberId) return null;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
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
    assessMctbCallHandlingReadiness({ workspaceId: input.workspaceId, phoneNumberId: phone.id }),
    assessAiReceptionistCallHandlingReadiness({
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
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
    phoneNumberId: phone.id,
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
  phoneNumberId?: string | null;
  handler: ActiveCallHandler;
  userId?: string | null;
}): Promise<CallHandlingOwnershipState> {
  const phoneNumberId = await resolveMctbPhoneNumberIdForWorkspace({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
  if (!phoneNumberId) {
    throw new Error("No forwarding phone number is configured for this workspace.");
  }

  return withCallHandlingSwitchLock(phoneNumberId, async () => {
    switchingPhones.add(phoneNumberId);
    try {
      const prisma = getPrisma();
      const phone = await prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
      });
      if (!phone?.e164 || !phone.providerNumberId) {
        throw new Error("Phone number is missing provider routing identifiers.");
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
            phoneNumberId: phone.id,
          });
          if (state) return state;
        }
      }

      if (input.handler === "mctb") {
        const readiness = await assessMctbCallHandlingReadiness({
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
        });
        if (!readiness.ready) {
          throw new Error(readiness.message || "MCTB is not ready for call handling.");
        }

        const inboundAgent = await resolveInboundAiAgent(input.workspaceId, phone.id);
        const parkedId =
          block.parkedAiReceptionistAgentId ||
          inboundAgent?.id ||
          null;

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
        await prisma.phoneNumber.update({
          where: { id: phone.id },
          data: { settingsJson: settings as object },
        });
      } else {
        const readiness = await assessAiReceptionistCallHandlingReadiness({
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
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
          throw new Error("Voice routing did not match the live phone connection.");
        }

        await clearMctbTexmlIngressLockMetadataForVoiceAgent({
          workspaceId: input.workspaceId,
          phoneNumberId: phone.id,
        });

        await syncVoiceAgentPhoneAssignment({
          workspaceId: input.workspaceId,
          agentId: readiness.agentId,
          phoneNumberId: phone.id,
          exclusive: true,
          allowMctbTexmlVoiceAgentTakeover: true,
        });

        const refreshed = await prisma.phoneNumber.findFirst({
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
        await prisma.phoneNumber.update({
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
        phoneNumberId: phone.id,
        handler: input.handler,
        userId: input.userId ?? null,
        priorConnectionId,
      });

      const state = await loadCallHandlingOwnershipState({
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
      });
      if (!state) throw new Error("Could not load call handling state.");
      return state;
    } catch (err) {
      console.warn("CALL_HANDLING_SWITCH_FAIL", {
        workspaceId: input.workspaceId,
        phoneNumberId,
        handler: input.handler,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      switchingPhones.delete(phoneNumberId);
    }
  });
}
