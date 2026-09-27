"use client";

import { MctbOnboardingRuntime } from "@/lib/mctb/onboarding/mctb-onboarding-runtime";

export function NewUiMctbOnboardingPage({ initialBusinessName = "" }: { initialBusinessName?: string }) {
  return <MctbOnboardingRuntime initialBusinessName={initialBusinessName} shell="opus" />;
}
