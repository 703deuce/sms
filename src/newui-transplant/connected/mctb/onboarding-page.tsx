"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

/**
 * Stage 2 onboarding is modal-only on `/mctb` (see `MctbFirstRunWizardHost`).
 * This export remains for transplant inventory — always routes to Overview.
 */
export function NewUiMctbOnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(MCTB_ROUTES.home);
  }, [router]);
  return null;
}
