import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceCallDetailPage } from "@/newui-transplant/connected/voice/call-detail-page";
import VoiceCallsDetailLegacyPage from "../calls-detail-legacy-page";

export default async function VoiceCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceCallDetailPage callId={id} />;
  }
  return <VoiceCallsDetailLegacyPage />;
}
