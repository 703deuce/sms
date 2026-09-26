import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceCallsIdPage } from "@/newui-transplant/mirror/routes/voice/calls/[id]/page";
import VoiceCallsDetailLegacyPage from "../calls-detail-legacy-page";

export default async function VoiceCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceCallsIdPage params={params} />;
  }
  return <VoiceCallsDetailLegacyPage />;
}
