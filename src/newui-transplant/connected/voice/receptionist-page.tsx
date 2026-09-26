import { VoiceReceptionistEditor } from "@/components/voice/receptionist/voice-receptionist-editor";
import { NewUiLegacyEditorPage } from "@/newui-transplant/connected/shared/legacy-editor-page";

export function NewUiVoiceReceptionistPage() {
  return (
    <NewUiLegacyEditorPage
      title="Receptionist"
      description="Configure how your AI receptionist greets callers, books appointments, and handles transfers."
    >
      <VoiceReceptionistEditor />
    </NewUiLegacyEditorPage>
  );
}
