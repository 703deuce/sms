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
    <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <Link
          href="/voice/receptionist"
          className="text-sm font-medium text-[#6b7280] hover:text-[#111827]"
        >
          ← Back to AI Receptionist
        </Link>
        <div className="order-last lg:order-none lg:col-start-2">
          <ReceptionistFlowStepper agentId={agentId} createMode={createMode} />
        </div>
        <div className="flex items-center justify-end gap-4 lg:col-start-3">
          <Link
            href="/help"
            className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827]"
          >
            <HelpCircle className="h-4 w-4" />
            Help Center
          </Link>
          {onSave ? (
            <button
              type="button"
              disabled={saveBusy}
              onClick={onSave}
              className="voice-btn-outline text-sm"
            >
              {saveBusy ? "Saving…" : "Save Changes"}
            </button>
          ) : null}
        </div>
      </div>

      {!createMode && agentTitle ? (
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            {agentTitle}
          </h1>
          {agentStatus ? (
            <p className="mt-0.5 text-sm text-[#6b7280] capitalize">{agentStatus}</p>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
