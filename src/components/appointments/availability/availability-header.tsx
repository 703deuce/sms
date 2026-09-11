"use client";

import { CalendarClock, Check, MoreHorizontal } from "lucide-react";

type Props = {
  saving: boolean;
  saved: boolean;
  error?: string;
  onSave: () => void;
  onPreview?: () => void;
};

export function AvailabilityHeader({ saving, saved, error, onSave, onPreview }: Props) {
  return (
    <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
      <div className="ws-event-head-main min-w-0">
        <div className="flex items-start gap-3">
          <span className="ws-icon-tile mt-0.5" aria-hidden>
            <CalendarClock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="ws-event-title">Availability</h1>
            <p className="ws-event-subtitle">
              Control staff schedules, booking hours, exceptions, and assignment rules.
            </p>
          </div>
        </div>
      </div>
      <div className="ws-event-head-actions flex shrink-0 items-center gap-2">
        {error ? <span className="ws-inline-error text-[var(--type-helper)]">{error}</span> : null}
        {onPreview ? (
          <button type="button" className="ws-secondary-btn" onClick={onPreview}>
            Preview availability
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          {saved && !saving ? (
            <span className="flex items-center gap-1 text-[var(--type-helper)] text-[var(--state-success)]" role="status">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          ) : null}
          <button
            type="button"
            className="appt-pilot-primary-btn"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
          <button type="button" className="ws-icon-btn" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
