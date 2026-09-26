import { AiRecoverySettingsPage } from "@/components/mctb/ai-recovery/ai-recovery-settings-page";
import { NewUiLegacyEditorPage } from "@/newui-transplant/connected/shared/legacy-editor-page";

export function NewUiMctbAiRecoveryPage() {
  return (
    <NewUiLegacyEditorPage
      title="AI Recovery"
      description="Automated replies that collect intent and share your booking link."
    >
      <AiRecoverySettingsPage />
    </NewUiLegacyEditorPage>
  );
}
