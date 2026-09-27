"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildReceptionistEditHref,
  CALL_HANDLING_SUB_NAV,
  parseCallHandlingSubView,
} from "@/lib/voice/receptionist/wizard-step-subview";
import { ReceptionistWizardSecondaryNav } from "./receptionist-wizard-secondary-nav";
import {
  VoiceCallHandlingRecentTransfersPanel,
  VoiceCallHandlingRoutingPanel,
} from "./call-handling-operations-panels";

export function CallHandlingStepOpusOperations({
  setupContent,
  sidePanel,
}: {
  setupContent: ReactNode;
  sidePanel?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const view = parseCallHandlingSubView(searchParams?.get("view"));

  const hrefFor = (id: typeof view) =>
    buildReceptionistEditHref(searchParams, { step: "call-handling", view: id });

  const main =
    view === "setup" ? (
      setupContent
    ) : view === "transfers" ? (
      <VoiceCallHandlingRecentTransfersPanel />
    ) : (
      <VoiceCallHandlingRoutingPanel />
    );

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <ReceptionistWizardSecondaryNav
          ariaLabel="Call handling views"
          items={CALL_HANDLING_SUB_NAV}
          activeId={view}
          hrefFor={hrefFor}
        />
        {main}
      </div>
      {view === "setup" ? sidePanel : null}
    </div>
  );
}
