"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  VoiceKnowledgeGapsPanel,
  VoiceKnowledgeSourcesPanel,
} from "./knowledge-operations-panels";
import { useVoiceKnowledgeOperations } from "./use-voice-knowledge-operations";

/**
 * Operational surfaces from /voice/knowledge that Step 3 does not duplicate as configuration.
 * Rendered inline below the canonical Information editor (no secondary nav).
 */
export function InformationStepOperationalExtras({
  state,
}: {
  state: AppointmentReceptionistWizardState;
}) {
  const ops = useVoiceKnowledgeOperations(state);

  return (
    <div className="space-y-8 border-t border-border pt-8">
      <VoiceKnowledgeGapsPanel
        gaps={ops.gaps}
        onDismissGap={(id) => ops.patchGap(id, "DISMISSED")}
        onResolveGap={(id, answer) => ops.patchGap(id, "RESOLVED", answer)}
      />
      <input
        ref={ops.uploadRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            void ops.handleUpload(file).catch((err) =>
              window.alert(err instanceof Error ? err.message : "Upload failed"),
            );
          }
        }}
      />
      <VoiceKnowledgeSourcesPanel
        sources={ops.sources}
        crawlSummary={ops.crawlSummary}
        websiteUrl={state.websiteUrl}
        onRecrawl={ops.triggerRecrawl}
        onUploadClick={() => ops.uploadRef.current?.click()}
      />
    </div>
  );
}
