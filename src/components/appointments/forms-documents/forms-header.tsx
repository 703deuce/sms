"use client";

import { FileStack, Plus } from "lucide-react";

type Props = {
  onNewForm: () => void;
  onNewDocument: () => void;
};

export function FormsHeader({ onNewForm, onNewDocument }: Props) {
  return (
    <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
      <div className="ws-event-head-main min-w-0">
        <div className="flex items-start gap-3">
          <span className="ws-icon-tile mt-0.5" aria-hidden>
            <FileStack className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="ws-event-title">Forms &amp; Documents</h1>
            <p className="ws-event-subtitle">
              Collect intake information, signatures, files, and required documents across the booking
              lifecycle.
            </p>
          </div>
        </div>
      </div>
      <div className="ws-event-head-actions flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" className="ws-secondary-btn" onClick={onNewDocument}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New document
        </button>
        <button type="button" className="appt-pilot-primary-btn" onClick={onNewForm}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New form
        </button>
      </div>
    </header>
  );
}
