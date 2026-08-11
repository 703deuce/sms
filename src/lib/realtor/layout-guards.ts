import { getActiveWorkspaceId } from "@/lib/auth";
import {
  isRealtorWorkspace,
  loadRealtorProductConfig,
  onboardingStepsForMode,
} from "@/lib/realtor/workspace-config";
import { redirect } from "next/navigation";

export async function requireRealtorOnboardingComplete() {
  const workspaceId = await getActiveWorkspaceId();
  const isRealtor = await isRealtorWorkspace(workspaceId);
  if (!isRealtor) redirect("/realtor/onboarding");
  const config = await loadRealtorProductConfig(workspaceId);
  if (!config.onboardingComplete || !config.live) {
    redirect("/realtor/onboarding");
  }
  return { workspaceId, config };
}

export async function loadRealtorOnboardingProps() {
  const workspaceId = await getActiveWorkspaceId();
  const config = await loadRealtorProductConfig(workspaceId);
  return {
    workspaceId,
    config,
    steps: onboardingStepsForMode(config.amyMode),
  };
}
