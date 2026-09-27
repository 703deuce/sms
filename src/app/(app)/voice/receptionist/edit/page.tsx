import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceReceptionistEditorPage } from "@/newui-transplant/connected/voice/receptionist-editor-page";
import { VoiceReceptionistEditor } from "@/components/voice/receptionist/voice-receptionist-editor";

export default function VoiceReceptionistEditPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceReceptionistEditorPage />;
  }
  return <VoiceReceptionistEditor />;
}
