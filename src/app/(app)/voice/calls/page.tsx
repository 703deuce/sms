import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceCallsPage } from "@/newui-transplant/mirror/routes/voice/calls/page";
import VoiceCallsLegacyPage from "./calls-legacy-page";

export default function VoiceCallsPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceCallsPage />;
  }
  return <VoiceCallsLegacyPage />;
}
