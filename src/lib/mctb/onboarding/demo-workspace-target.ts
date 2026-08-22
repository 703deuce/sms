import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveOnboardingWorkspaceForDemoCall } from "@/lib/agents/missed-call-text-back/demo-bypass";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { resolveMctbSipIngressByDid } from "@/lib/mctb/sip-ingress/resolver";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";

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
      isPlatformDemo: isPlatformDemoNumber(transovoE164),
      demoMode,
    };
  }

  const pn = await getPrisma().phoneNumber.findFirst({
    where: { e164: transovoE164 },
    select: { workspaceId: true },
  });
  if (pn?.workspaceId) {
    return {
      workspaceId: pn.workspaceId,
      isPlatformDemo: isPlatformDemoNumber(transovoE164),
      demoMode: false,
    };
  }

  const isPlatformDemo = isPlatformDemoNumber(transovoE164);
  if (!isPlatformDemo) {
    return {
      workspaceId: input.fallbackWorkspaceId,
      isPlatformDemo: false,
      demoMode: false,
    };
  }

  const demoWorkspaceId = await resolveOnboardingWorkspaceForDemoCall(
    input.callerE164,
    input.businessE164,
    input.forwardedFrom,
  );

  const workspaceId = demoWorkspaceId || input.fallbackWorkspaceId;
  let demoMode = false;
  if (demoWorkspaceId) {
    const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
    const state = await loadMctbOnboardingState(demoWorkspaceId);
    demoMode = resolveRuntimeDemoMode({
      workspaceId: demoWorkspaceId,
      transovoNumberE164: transovoE164,
      callerE164: input.callerE164,
      forwardedFromE164: input.forwardedFrom,
      demoSession: state.demoSession,
    });
  }

  return {
    workspaceId,
    isPlatformDemo: true,
    demoMode,
  };
}
