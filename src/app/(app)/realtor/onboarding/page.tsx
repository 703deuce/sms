import { RealtorOnboardingWizard } from "@/components/realtor/onboarding-wizard";
import { loadRealtorOnboardingProps } from "@/lib/realtor/layout-guards";
import { redirect } from "next/navigation";

export default async function RealtorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step: stepParam } = await searchParams;
  const { config, steps } = await loadRealtorOnboardingProps();
  if (config.onboardingComplete && config.live && !stepParam) {
    redirect("/realtor/dashboard");
  }
  const jumpStep = stepParam && steps.includes(stepParam as typeof steps[number])
    ? (stepParam as typeof steps[number])
    : undefined;
  return (
    <RealtorOnboardingWizard
      initialConfig={jumpStep ? { ...config, currentStep: jumpStep } : config}
      steps={steps}
    />
  );
}
