import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbSetupWorkspaceLayout } from "@/newui-transplant/components/mctb/setup-workspace-layout";

export default function MctbSetupLayout({ children }: { children: React.ReactNode }) {
  if (!isNewUiStage2Enabled()) {
    return children;
  }
  return <MctbSetupWorkspaceLayout>{children}</MctbSetupWorkspaceLayout>;
}
