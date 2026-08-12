import { getActiveWorkspaceId } from "@/lib/auth";
import {
  isRealtorWorkspace,
  loadRealtorProductConfig,
  onboardingStepsForConfig,
} from "@/lib/realtor/workspace-config";
import { redirect } from "next/navigation";

export async function requireRealtorOnboardingComplete() {
  const workspaceId = await getActiveWorkspaceId();
  const isRealtor = await isRealtorWorkspace(workspaceId);
  if (!isRealtor) redirect("/realtor/onboarding");
  const config = await loadRealtorProductConfig(workspaceId);
  const hasPublishedFrontDesk = Boolean(
    config.deployedAgentId?.trim() && config.frontDeskPublishedVersionId?.trim(),
  );
  if ((!config.onboardingComplete || !config.live) && !hasPublishedFrontDesk) {
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
    steps: onboardingStepsForConfig(config),
  };
}
