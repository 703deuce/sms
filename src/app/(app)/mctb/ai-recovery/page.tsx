import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbAiRecoveryPage } from "@/newui-transplant/connected/mctb/ai-recovery-page";
import { AiRecoverySettingsPage } from "@/components/mctb/ai-recovery/ai-recovery-settings-page";

export default function MctbAiRecoveryPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbAiRecoveryPage />;
  }
  return <AiRecoverySettingsPage />;
}
