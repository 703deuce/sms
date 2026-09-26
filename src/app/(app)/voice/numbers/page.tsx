import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceNumbersPage } from "@/newui-transplant/connected/voice/numbers-page";
import { VoiceNumbersPage as LegacyVoiceNumbersPage } from "@/components/voice/numbers/voice-numbers-page";

export default function VoiceNumbersPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceNumbersPage />;
  }
  return <LegacyVoiceNumbersPage />;
}
