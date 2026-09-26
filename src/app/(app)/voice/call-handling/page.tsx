import { CallHandlingOperationalPage } from "@/components/voice/call-handling-operational-page";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceCallHandlingPage } from "@/newui-transplant/connected/voice/call-handling-page";

export default function VoiceCallHandlingPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceCallHandlingPage />;
  }
  return <CallHandlingOperationalPage />;
}
