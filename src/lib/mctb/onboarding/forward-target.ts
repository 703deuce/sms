import { formatDemoPhoneDisplay } from "./demo";
import {
  getMctbDemoIngressE164,
  getProductionMctbForwardTargetE164,
} from "./phone-numbers";
import { MCTB_PLATFORM_DEMO_DISPLAY } from "./constants";

/** @deprecated Demo only — use getMctbDemoIngressE164() */
export function getOnboardingForwardTargetE164(): string {
  return getMctbDemoIngressE164();
}

/** Production forward target — customer's assigned MCTB DID (not the demo line). */
export async function getOnboardingForwardTargetE164ForWorkspace(
  workspaceId: string,
): Promise<string | null> {
  return getProductionMctbForwardTargetE164(workspaceId);
}

export function getOnboardingForwardTargetDisplay(): string {
  return MCTB_PLATFORM_DEMO_DISPLAY;
}

export function formatOnboardingForwardTarget(e164: string): string {
  return formatDemoPhoneDisplay(e164);
}
