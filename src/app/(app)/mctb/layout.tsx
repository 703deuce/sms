import { Suspense } from "react";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";

export default async function MctbProductLayout({ children }: { children: React.ReactNode }) {
  if (!isNewUiStage2Enabled()) {
    const { MctbLegacyShellStyles } = await import("./mctb-legacy-shell-styles");
    return (
      <>
        <MctbLegacyShellStyles />
        {children}
      </>
    );
  }
  const { MctbFirstRunWizardHost } = await import(
    "@/components/mctb/onboarding/mctb-first-run-wizard-host"
  );
  return (
    <>
      <Suspense fallback={null}>
        <MctbFirstRunWizardHost />
      </Suspense>
      {children}
    </>
  );
}
