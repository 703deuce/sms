import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceAnalyticsPage } from "@/newui-transplant/mirror/routes/voice/analytics/page";
import { VoiceAnalyticsDashboard } from "@/components/voice/voice-analytics-dashboard";

export default function VoiceAnalyticsPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceAnalyticsPage />;
  }
  return <VoiceAnalyticsDashboard />;
}
