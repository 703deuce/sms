import { redirect } from "next/navigation";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceNumbersPage } from "@/newui-transplant/connected/voice/numbers-page";

export default function VoiceNumbersPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceNumbersPage />;
  }
  redirect("/numbers");
}
