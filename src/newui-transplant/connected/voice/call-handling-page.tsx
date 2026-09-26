import { CallHandlingOperationalPage } from "@/components/voice/call-handling-operational-page";
import { NewUiLegacyEditorPage } from "@/newui-transplant/connected/shared/legacy-editor-page";

export function NewUiVoiceCallHandlingPage() {
  return (
    <NewUiLegacyEditorPage
      title="Call Handling"
      description="Business hours, transfers, spam protection, and who answers when you're unavailable."
    >
      <CallHandlingOperationalPage />
    </NewUiLegacyEditorPage>
  );
}
