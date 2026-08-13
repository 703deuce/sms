"use client";

import { ReceptionistFlowStepper } from "@/components/receptionist/receptionist-flow-stepper";
import Link from "next/link";
import { HelpCircle } from "lucide-react";

export function ReceptionistEditorShell({
  agentId,
  createMode,
  agentTitle,
  agentStatus,
  children,
  onSave,
  saveBusy,
}: {
  agentId?: string;
  createMode?: boolean;
  agentTitle?: string;
  agentStatus?: string;
  children: React.ReactNode;
  onSave?: () => void;
  saveBusy?: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/voice/agents"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to Agents
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/help"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            Help Center
          </Link>
          {onSave ? (
            <button
              type="button"
              disabled={saveBusy}
              onClick={onSave}
              className="voice-btn-primary text-sm"
            >
              {saveBusy ? "Saving…" : "Save Changes"}
            </button>
          ) : null}
        </div>
      </div>

      {!createMode && agentTitle ? (
        <div className="mb-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">{agentTitle}</h1>
          {agentStatus ? (
            <p className="text-sm text-muted-foreground capitalize">{agentStatus}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-8">
        <ReceptionistFlowStepper agentId={agentId} createMode={createMode} />
      </div>

      {children}
    </div>
  );
}
