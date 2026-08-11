import { RealtorOnboardingWizard } from "@/components/realtor/onboarding-wizard";
import { loadRealtorOnboardingProps } from "@/lib/realtor/layout-guards";
import { redirect } from "next/navigation";

export default async function RealtorOnboardingPage() {
  const { config, steps } = await loadRealtorOnboardingProps();
  if (config.onboardingComplete && config.live) {
    redirect("/realtor/dashboard");
  }
  return <RealtorOnboardingWizard initialConfig={config} steps={steps} />;
}
