import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceCallHandlingPage } from "@/newui-transplant/mirror/routes/voice/call-handling/page";
import { CallHandlingOperationalPage } from "@/components/voice/call-handling-operational-page";

export default function VoiceCallHandlingPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceCallHandlingPage />;
  }
  return <CallHandlingOperationalPage />;
}
