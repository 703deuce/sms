"use client";

import { MctbOnboardingRuntime } from "@/lib/mctb/onboarding/mctb-onboarding-runtime";

type Props = { initialBusinessName?: string };

/** Legacy MCTB onboarding presentation (CSS wizard shell). */
export function MctbOnboardingWizard({ initialBusinessName = "" }: Props) {
  return <MctbOnboardingRuntime initialBusinessName={initialBusinessName} shell="legacy" />;
}
