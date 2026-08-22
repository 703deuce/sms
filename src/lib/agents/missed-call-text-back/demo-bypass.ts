import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import {
  getPlatformDemoNumberE164,
  isPlatformDemoNumber,
  isDemoModeForWorkspace,
} from "@/lib/mctb/onboarding/demo";

export type DemoBypassContext = {
  isDemo: boolean;
  workspaceId: string;
  callerE164: string;
  businessE164: string;
};

export async function resolveDemoBypassContext(input: {
  workspaceId: string;
  callerE164: string;
  businessE164: string;
}): Promise<DemoBypassContext> {
  if (!isPlatformDemoNumber(input.businessE164)) {
    return { isDemo: false, ...input };
  }

  const state = await loadMctbOnboardingState(input.workspaceId);
  const isDemo = isDemoModeForWorkspace(
    input.workspaceId,
    input.businessE164,
    input.callerE164,
    state.demoSession,
  );
  return { isDemo, ...input };
}

export async function resolveOnboardingWorkspaceForDemoCall(
  callerE164: string,
  businessE164: string,
  forwardedFrom?: string | null,
): Promise<string | null> {
  if (!isPlatformDemoNumber(businessE164)) return null;
  const { resolveOnboardingWorkspaceForPlatformInbound } = await import(
    "@/lib/mctb/onboarding/demo"
  );
  return resolveOnboardingWorkspaceForPlatformInbound({
    callerE164,
    forwardedFrom,
  });
}

export function getDemoNumber(): string {
  return getPlatformDemoNumberE164();
}

export {
  resolvePlatformDemoSmsSender,
  resolvePlatformDemoOwnerWorkspaceId,
} from "@/lib/mctb/onboarding/platform-demo";

export function normalizeDemoE164(e164: string): string {
  return normalizeE164(e164);
}
