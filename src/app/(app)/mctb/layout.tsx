import { Suspense } from "react";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { ensureMctbWorkspaceBootstrap } from "@/lib/mctb/provisioning/workspace-bootstrap";

export default async function MctbProductLayout({ children }: { children: React.ReactNode }) {
  if (isMctbV1Primary()) {
    const { workspaceId } = await requireWorkspaceContext();
    await ensureMctbWorkspaceBootstrap(workspaceId).catch(() => undefined);
  }
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
