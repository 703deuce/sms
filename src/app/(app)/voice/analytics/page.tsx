import { VoiceAnalyticsDashboard } from "@/components/voice/voice-analytics-dashboard";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceAnalyticsPage } from "@/newui-transplant/connected/voice/analytics-page";
import { Suspense } from "react";

export default function VoiceAnalyticsPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceAnalyticsPage />;
  }
  return (
    <Suspense fallback={null}>
      <VoiceAnalyticsDashboard />
    </Suspense>
  );
}
