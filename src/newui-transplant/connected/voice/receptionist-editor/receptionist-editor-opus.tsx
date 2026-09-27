"use client";

import { useState } from "react";
import type { useVoiceReceptionistEditor } from "@/lib/voice/receptionist/use-voice-receptionist-editor";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { Page, PageHeader, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { ReceptionistEditorSteps } from "./receptionist-editor-steps";
import type { ReceptionistEditorStage } from "./types";
import { IdentityConversationStage } from "./stages/identity-conversation-stage";
import { ResponsibilitiesStage } from "./stages/responsibilities-stage";
import { ReviewTestStage } from "./stages/review-test-stage";

function statusTone(tone: "muted" | "warning" | "success"): "neutral" | "warning" | "success" {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  return "neutral";
}

type Editor = ReturnType<typeof useVoiceReceptionistEditor>;

export function ReceptionistEditorOpus({ editor }: { editor: Editor }) {
  const [stage, setStage] = useState<ReceptionistEditorStage>("identity");

  if (!editor.hydrated) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Loading receptionist…</p>
      </Page>
    );
  }

  const { headerStatus, hasLocalEdits, isLive, pendingPublication, busy } = editor;

  const footerMessage = hasLocalEdits
    ? "You have unsaved changes."
    : isLive && pendingPublication
      ? "Draft saved — publish to update live calls."
      : isLive
        ? "Live configuration is active."
        : "Save a draft before testing or going live.";

  return (
    <Page className="pb-28">
      <PageHeader
        title="Receptionist"
        description="Configure how your AI receptionist speaks, collects information, and helps callers."
        status={<Pill tone={statusTone(headerStatus.tone)}>{headerStatus.label}</Pill>}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                editor.setShowTestPanel(true);
                setStage("review");
              }}
            >
              Test receptionist
            </Button>
            {isLive && !hasLocalEdits && !pendingPublication ? null : (
              <Button type="button" disabled={busy} onClick={() => void editor.publish()}>
                {busy ? "Publishing…" : editor.state.agentId && isLive ? "Publish changes" : "Go live"}
              </Button>
            )}
            <ButtonLink href="/voice/receptionist" variant="ghost">Back to summary</ButtonLink>
          </>
        }
      />

      <div aria-live="polite" className="mb-4 min-h-[1.25rem] text-sm text-muted-foreground">
        {editor.statusMessage}
      </div>

      {editor.error ? (
        <div
          className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {editor.error}
        </div>
      ) : null}

      {isLive && (pendingPublication || hasLocalEdits) ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Live callers use your published configuration until you publish saved changes.
        </p>
      ) : null}

      <ReceptionistEditorSteps stage={stage} onStageChange={setStage} />

      {stage === "identity" ? (
        <IdentityConversationStage state={editor.state} patch={editor.patch} />
      ) : null}
      {stage === "responsibilities" ? (
        <ResponsibilitiesStage
          state={editor.state}
          patch={editor.patch}
          hoursSummary={editor.hoursSummary}
          transferIssues={editor.transferIssues}
          calendarSummary={editor.calendarSummary}
        />
      ) : null}
      {stage === "review" ? (
        <ReviewTestStage
          state={editor.state}
          patch={editor.patch}
          calendarSummary={editor.calendarSummary}
          transferIssues={editor.transferIssues}
          onGoToStage={setStage}
          onEnsureAgent={editor.ensureAgentForTest}
          isLive={isLive}
          pendingPublication={pendingPublication}
          hasLocalEdits={hasLocalEdits}
          busy={busy}
          onPublish={() => void editor.publish()}
        />
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:pl-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{footerMessage}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {stage !== "identity" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setStage(stage === "review" ? "responsibilities" : "identity")
                }
              >
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy || !hasLocalEdits}
              onClick={() => void editor.saveDraftGroups()}
            >
              {busy ? "Saving…" : "Save draft"}
            </Button>
            {stage === "identity" ? (
              <Button type="button" onClick={() => setStage("responsibilities")}>Continue</Button>
            ) : null}
            {stage === "responsibilities" ? (
              <Button type="button" onClick={() => setStage("review")}>Review & test</Button>
            ) : null}
            {stage === "review" && (hasLocalEdits || pendingPublication || !isLive) ? (
              <Button type="button" disabled={busy} onClick={() => void editor.publish()}>
                {busy ? "Working…" : isLive ? "Publish changes" : "Go live"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Page>
  );
}
