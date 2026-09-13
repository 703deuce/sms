import { MctbVoiceAgentPage } from "@/components/mctb/voice-agent/mctb-voice-agent-page";
import { Suspense } from "react";

export default function MctbVoiceAgentRoutePage() {
  return (
    <Suspense fallback={<div className="mctb-page-container text-sm text-muted-foreground">Loading…</div>}>
      <MctbVoiceAgentPage />
    </Suspense>
  );
}
