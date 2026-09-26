import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceReceptionistPage } from "@/newui-transplant/mirror/routes/voice/receptionist/page";
import { VoiceReceptionistEditor } from "@/components/voice/receptionist/voice-receptionist-editor";

export default function VoiceReceptionistPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceReceptionistPage />;
  }
  return <VoiceReceptionistEditor />;
}
