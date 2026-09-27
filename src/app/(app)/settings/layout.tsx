import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { SettingsWorkspaceLayout } from "@/newui-transplant/components/settings/settings-workspace-layout";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!isNewUiStage2Enabled()) {
    return children;
  }
  return <SettingsWorkspaceLayout>{children}</SettingsWorkspaceLayout>;
}
