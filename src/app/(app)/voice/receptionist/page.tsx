import { VoiceReceptionistEditor } from "@/components/voice/receptionist/voice-receptionist-editor";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceReceptionistPage } from "@/newui-transplant/connected/voice/receptionist-page";

export default function VoiceReceptionistPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceReceptionistPage />;
  }
  return <VoiceReceptionistEditor />;
}
