import { formatDemoPhoneDisplay } from "./demo";
import { getProductionMctbForwardTargetE164 } from "./phone-numbers";

/** @deprecated Use getOnboardingForwardTargetE164ForWorkspace(workspaceId). */
export async function getOnboardingForwardTargetE164(workspaceId: string): Promise<string | null> {
  return getProductionMctbForwardTargetE164(workspaceId);
}

/** Production forward target — customer's assigned MCTB DID. */
export async function getOnboardingForwardTargetE164ForWorkspace(
  workspaceId: string,
): Promise<string | null> {
  return getProductionMctbForwardTargetE164(workspaceId);
}

export function formatOnboardingForwardTarget(e164: string): string {
  return formatDemoPhoneDisplay(e164);
}
