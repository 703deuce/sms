import { resolveOnboardingWorkspaceForDemoCall } from "@/lib/agents/missed-call-text-back/demo-bypass";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";

/** Onboarding workspace for platform-demo inbound (571) when an active demo session exists. */
export async function resolveMctbTargetWorkspaceForInboundCall(input: {
  callerE164: string;
  businessE164: string;
  fallbackWorkspaceId: string;
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
  );

  return {
    workspaceId: demoWorkspaceId || input.fallbackWorkspaceId,
    isPlatformDemo: true,
    demoMode: Boolean(demoWorkspaceId),
  };
}
