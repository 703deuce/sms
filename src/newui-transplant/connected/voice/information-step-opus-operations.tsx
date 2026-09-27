"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  buildReceptionistEditHref,
  INFORMATION_SUB_NAV,
  parseInformationSubView,
} from "@/lib/voice/receptionist/wizard-step-subview";
import { ReceptionistWizardSecondaryNav } from "./receptionist-wizard-secondary-nav";
import {
  VoiceKnowledgeGapsPanel,
  VoiceKnowledgeSourcesPanel,
} from "./knowledge-operations-panels";
import { useVoiceKnowledgeOperations } from "./use-voice-knowledge-operations";

export function InformationStepOpusOperations({
  state,
  setupContent,
  sidePanel,
}: {
  state: AppointmentReceptionistWizardState;
  setupContent: ReactNode;
  sidePanel?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const view = parseInformationSubView(searchParams?.get("view"));
  const ops = useVoiceKnowledgeOperations(state);

  const hrefFor = (id: typeof view) =>
    buildReceptionistEditHref(searchParams, { step: "information", view: id });

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <ReceptionistWizardSecondaryNav
          ariaLabel="Information views"
          items={INFORMATION_SUB_NAV}
          activeId={view}
          hrefFor={hrefFor}
        />
        {view === "setup" ? setupContent : null}
        {view === "gaps" ? (
        <VoiceKnowledgeGapsPanel
          gaps={ops.gaps}
          onDismissGap={(id) => ops.patchGap(id, "DISMISSED")}
          onResolveGap={(id, answer) => ops.patchGap(id, "RESOLVED", answer)}
        />
      ) : null}
      {view === "sources" ? (
        <>
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
        </>
      ) : null}
      </div>
      {view === "setup" ? sidePanel : null}
    </div>
  );
}
