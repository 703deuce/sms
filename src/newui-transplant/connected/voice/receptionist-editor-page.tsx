"use client";

import Link from "next/link";
import { Page, PageHeader, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { VoiceReceptionistEditorSections } from "@/components/voice/receptionist/voice-receptionist-editor-sections";
import { useVoiceReceptionistEditor } from "@/lib/voice/receptionist/use-voice-receptionist-editor";

function statusTone(tone: "muted" | "warning" | "success") {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  return "neutral";
}

export function NewUiVoiceReceptionistEditorPage() {
  const editor = useVoiceReceptionistEditor();

  if (!editor.hydrated) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Loading receptionist…</p>
      </Page>
    );
  }

  const { headerStatus, hasLocalEdits, isLive, pendingPublication, busy } = editor;

  return (
    <Page className="pb-28">
      <PageHeader
        title="Receptionist"
        description="Configure how your AI receptionist speaks, collects information, and helps callers."
        status={<Pill tone={statusTone(headerStatus.tone)}>{headerStatus.label}</Pill>}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => editor.setShowTestPanel((v) => !v)}>
              Test receptionist
            </Button>
            {isLive && !hasLocalEdits && !pendingPublication ? null : (
              <Button type="button" disabled={busy} onClick={() => void editor.publish()}>
                {busy ? "Publishing…" : editor.state.agentId && isLive ? "Publish changes" : "Go live"}
              </Button>
            )}
            <Button type="button" variant="ghost" asChild>
              <Link href="/voice/receptionist">Back to summary</Link>
            </Button>
          </>
        }
      />

      <div aria-live="polite" className="mb-4 min-h-[1.25rem] text-sm text-muted-foreground">
        {editor.statusMessage}
      </div>

      {editor.error ? (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {editor.error}
        </div>
      ) : null}

      {isLive && (pendingPublication || hasLocalEdits) ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Live callers use your published configuration until you publish saved changes.
        </p>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <VoiceReceptionistEditorSections
          state={editor.state}
          patch={editor.patch}
          hoursSummary={editor.hoursSummary}
          transferIssues={editor.transferIssues}
          calendarSummary={editor.calendarSummary}
          showTestPanel={editor.showTestPanel}
          onEnsureAgent={editor.ensureAgentForTest}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:pl-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {hasLocalEdits
              ? "You have unsaved changes."
              : isLive && pendingPublication
                ? "Draft saved — publish to update live calls."
                : isLive
                  ? "Live configuration is active."
                  : "Save a draft before testing or going live."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !hasLocalEdits}
              onClick={() => void editor.saveDraftGroups()}
            >
              {busy ? "Saving…" : "Save draft"}
            </Button>
            {(hasLocalEdits || pendingPublication || !isLive) && (
              <Button type="button" disabled={busy} onClick={() => void editor.publish()}>
                {busy ? "Working…" : isLive ? "Publish changes" : "Go live"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
