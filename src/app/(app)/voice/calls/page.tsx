import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceCallsPage } from "@/newui-transplant/connected/voice/calls-page";
import VoiceCallsLegacyPage from "./calls-legacy-page";

export default function VoiceCallsPage() {
  if (!isNewUiStage2Enabled()) {
    return <VoiceCallsLegacyPage />;
  }
  return <NewUiVoiceCallsPage />;
}
