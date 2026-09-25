import { VoiceOverviewDashboard } from "@/components/voice/voice-overview-dashboard";
import { Suspense } from "react";

export default function VoiceOverviewPage() {
  return (
    <Suspense fallback={null}>
      <VoiceOverviewDashboard />
    </Suspense>
  );
}
