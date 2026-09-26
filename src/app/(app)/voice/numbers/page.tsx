import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceNumbersPage } from "@/newui-transplant/mirror/routes/voice/numbers/page";
import { VoiceNumbersPage as LegacyVoiceNumbersPage } from "@/components/voice/numbers/voice-numbers-page";

export default function VoiceNumbersPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceNumbersPage />;
  }
  return <LegacyVoiceNumbersPage />;
}
