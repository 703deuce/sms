import "@/components/mctb/shell/mctb-design-tokens.css";
import "@/components/mctb/shell/mctb-global-overrides.css";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { IntegrationsWorkspaceLayout } from "@/newui-transplant/components/integrations/integrations-workspace-layout";

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  if (isNewUiStage2Enabled()) {
    return <IntegrationsWorkspaceLayout>{children}</IntegrationsWorkspaceLayout>;
  }
  return <div className="integrations-mctb-shell min-h-full">{children}</div>;
}
