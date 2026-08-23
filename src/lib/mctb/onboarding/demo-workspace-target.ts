import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveOnboardingWorkspaceForDemoCall } from "@/lib/agents/missed-call-text-back/demo-bypass";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { resolveMctbSipIngressByDid } from "@/lib/mctb/sip-ingress/resolver";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";

async function resolvePhoneOwnerWorkspace(e164: string): Promise<string | null> {
  const pn = await getPrisma().phoneNumber.findFirst({
    where: { e164 },
    select: { workspaceId: true },
  });
  return pn?.workspaceId || null;
}

async function resolvePlatformDemoTarget(input: {
  callerE164: string;
  transovoE164: string;
  fallbackWorkspaceId: string;
  forwardedFrom?: string | null;
}): Promise<{ workspaceId: string; demoMode: boolean }> {
  const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");

  const tenantWorkspaceId =
    (await resolveOnboardingWorkspaceForDemoCall(
      input.callerE164,
      input.transovoE164,
      input.forwardedFrom,
    )) ||
    (await resolvePhoneOwnerWorkspace(input.transovoE164)) ||
    input.fallbackWorkspaceId;

  const state = await loadMctbOnboardingState(tenantWorkspaceId);
  const demoMode = resolveRuntimeDemoMode({
    workspaceId: tenantWorkspaceId,
    transovoNumberE164: input.transovoE164,
    callerE164: input.callerE164,
    forwardedFromE164: input.forwardedFrom,
    demoSession: state.demoSession,
  });

  return { workspaceId: tenantWorkspaceId, demoMode };
}

/** Resolve workspace + demoMode from called Transovo DID (sip.trunkPhoneNumber). */
export async function resolveMctbTargetWorkspaceForInboundCall(input: {
  callerE164: string;
  businessE164: string;
  fallbackWorkspaceId: string;
  forwardedFrom?: string | null;
}): Promise<{ workspaceId: string; isPlatformDemo: boolean; demoMode: boolean }> {
  let transovoE164 = input.businessE164;
  try {
    transovoE164 = normalizeE164(input.businessE164);
  } catch {
    // keep raw
  }

  const isPlatformDemo = isPlatformDemoNumber(transovoE164);

  // Platform 571: tenant comes from active Try It / onboarding session (caller phone),
  // not from DID ownership — otherwise Press-1 SMS and Try It progress never attach.
  if (isPlatformDemo) {
    const target = await resolvePlatformDemoTarget({
      callerE164: input.callerE164,
      transovoE164,
      fallbackWorkspaceId: input.fallbackWorkspaceId,
      forwardedFrom: input.forwardedFrom,
    });
    return {
      workspaceId: target.workspaceId,
      isPlatformDemo: true,
      demoMode: target.demoMode,
    };
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

  const ownerWorkspaceId = await resolvePhoneOwnerWorkspace(transovoE164);
  if (ownerWorkspaceId) {
    return {
      workspaceId: ownerWorkspaceId,
      isPlatformDemo: false,
      demoMode: false,
    };
  }

  return {
    workspaceId: input.fallbackWorkspaceId,
    isPlatformDemo: false,
    demoMode: false,
  };
}
