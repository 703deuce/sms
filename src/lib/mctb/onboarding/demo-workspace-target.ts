import { resolveOnboardingWorkspaceForDemoCall } from "@/lib/agents/missed-call-text-back/demo-bypass";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";

/** Onboarding workspace for platform-demo inbound (571) during demo, forwarding, or live test. */
export async function resolveMctbTargetWorkspaceForInboundCall(input: {
  callerE164: string;
  businessE164: string;
  fallbackWorkspaceId: string;
  forwardedFrom?: string | null;
}): Promise<{ workspaceId: string; isPlatformDemo: boolean; demoMode: boolean }> {
  const isPlatformDemo = isPlatformDemoNumber(input.businessE164);
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
    const { isDemoModeForWorkspace } = await import("@/lib/mctb/onboarding/demo");
    const state = await loadMctbOnboardingState(demoWorkspaceId);
    demoMode =
      isDemoModeForWorkspace(
        demoWorkspaceId,
        input.businessE164,
        input.callerE164,
        state.demoSession,
      ) ||
      Boolean(state.liveTestSession?.startedAt && !state.liveTestPassedAt) ||
      Boolean(state.forwardingTestStartedAt && !state.liveTestPassedAt);
  }

  return {
    workspaceId,
    isPlatformDemo: true,
    demoMode,
  };
}
