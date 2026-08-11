import { getActiveWorkspaceId } from "@/lib/auth";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { redirect } from "next/navigation";

export default async function RealtorIndexPage() {
  const workspaceId = await getActiveWorkspaceId();
  const config = await loadRealtorProductConfig(workspaceId);
  if (!config.onboardingComplete || !config.live) {
    redirect("/realtor/onboarding");
  }
  redirect("/realtor/dashboard");
}
