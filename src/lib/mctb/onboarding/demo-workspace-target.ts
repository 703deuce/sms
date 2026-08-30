import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveOnboardingWorkspaceForDemoCall } from "@/lib/agents/missed-call-text-back/demo-bypass";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { resolveMctbSipIngressByDid } from "@/lib/mctb/sip-ingress/resolver";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";
import { resolveMctbAssignedWorkspaceForPhone } from "@/lib/mctb/sip-ingress/resolver";
import { isMctbTexmlVoiceIngress, isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";

export type MctbInboundWorkspaceTarget = {
  workspaceId: string | null;
  isPlatformDemo: boolean;
  demoMode: boolean;
};

async function resolvePhoneRow(e164: string) {
  return getPrisma().phoneNumber.findFirst({
    where: { e164 },
    select: { id: true, workspaceId: true, settingsJson: true },
  });
}

async function resolvePlatformDemoTarget(input: {
  callerE164: string;
  transovoE164: string;
  forwardedFrom?: string | null;
}): Promise<MctbInboundWorkspaceTarget> {
  const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");

  const tenantWorkspaceId =
    (await resolveOnboardingWorkspaceForDemoCall(
      input.callerE164,
      input.transovoE164,
      input.forwardedFrom,
    )) ||
    (await (async () => {
      const { resolveLinkedPlatformDemoTenantWorkspace } = await import(
        "@/lib/mctb/tenant-production-binding"
      );
      return resolveLinkedPlatformDemoTenantWorkspace(input.transovoE164);
    })()) ||
    null;

  if (!tenantWorkspaceId) {
    return { workspaceId: null, isPlatformDemo: true, demoMode: false };
  }

  const state = await loadMctbOnboardingState(tenantWorkspaceId);
  const demoMode = resolveRuntimeDemoMode({
    workspaceId: tenantWorkspaceId,
    transovoNumberE164: input.transovoE164,
    callerE164: input.callerE164,
    forwardedFromE164: input.forwardedFrom,
    demoSession: state.demoSession,
  });

  return { workspaceId: tenantWorkspaceId, isPlatformDemo: true, demoMode };
}

/**
 * Resolve workspace + demoMode from called Transovo DID.
 * Never falls back to platform owner / admin workspace — returns workspaceId=null when unresolved.
 */
export async function resolveMctbTargetWorkspaceForInboundCall(input: {
  callerE164: string;
  businessE164: string;
  forwardedFrom?: string | null;
}): Promise<MctbInboundWorkspaceTarget> {
  let transovoE164 = input.businessE164;
  try {
    transovoE164 = normalizeE164(input.businessE164);
  } catch {
    // keep raw
  }

  if (isPlatformDemoNumber(transovoE164)) {
    return resolvePlatformDemoTarget({
      callerE164: input.callerE164,
      transovoE164,
      forwardedFrom: input.forwardedFrom,
    });
  }

  const ingress = await resolveMctbSipIngressByDid(transovoE164);
  if (ingress.workspaceId) {
    const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
    const state = await loadMctbOnboardingState(ingress.workspaceId);
    const demoMode = resolveRuntimeDemoMode({
      workspaceId: ingress.workspaceId,
      transovoNumberE164: transovoE164,
      callerE164: input.callerE164,
      forwardedFromE164: input.forwardedFrom,
      demoSession: state.demoSession,
    });

    return {
      workspaceId: ingress.workspaceId,
      isPlatformDemo: false,
      demoMode,
    };
  }

  const phone = await resolvePhoneRow(transovoE164);
  if (phone) {
    const assignedWorkspaceId = await resolveMctbAssignedWorkspaceForPhone({
      phoneNumberId: phone.id,
      ownerWorkspaceId: phone.workspaceId,
      settingsJson: phone.settingsJson,
    });
    if (assignedWorkspaceId) {
      return {
        workspaceId: assignedWorkspaceId,
        isPlatformDemo: false,
        demoMode: false,
      };
    }

    const caps = readPhoneCapabilities({ settingsJson: phone.settingsJson });
    if (
      caps.mctbEnabled ||
      isMctbTexmlVoiceIngress(phone.settingsJson) ||
      isPhoneMctbSipIngress(phone.settingsJson)
    ) {
      return {
        workspaceId: phone.workspaceId,
        isPlatformDemo: false,
        demoMode: false,
      };
    }
  }

  return { workspaceId: null, isPlatformDemo: false, demoMode: false };
}
