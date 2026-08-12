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
  if (!isRealtor) redirect("/realtor/setup");
  const config = await loadRealtorProductConfig(workspaceId);
  if (!config.onboardingComplete || !config.live) {
    redirect("/realtor/setup");
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
