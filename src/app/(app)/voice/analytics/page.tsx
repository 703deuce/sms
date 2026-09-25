import { VoiceAnalyticsDashboard } from "@/components/voice/voice-analytics-dashboard";
import { Suspense } from "react";

export default function VoiceAnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <VoiceAnalyticsDashboard />
    </Suspense>
  );
}
