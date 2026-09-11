"use client";

import { Check, Wallet } from "lucide-react";

type Props = {
  saving: boolean;
  saved: boolean;
  error?: string;
  onSave: () => void;
  onPreviewCheckout?: () => void;
};

export function PricingHeader({ saving, saved, error, onSave, onPreviewCheckout }: Props) {
  return (
    <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
      <div className="ws-event-head-main min-w-0">
        <div className="flex items-start gap-3">
          <span className="ws-icon-tile mt-0.5" aria-hidden>
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <h1 className="ws-event-title">Pricing & Payments</h1>
            <p className="ws-event-subtitle">
              Manage booking charges, deposits, access methods, discounts, and payment providers.
            </p>
          </div>
        </div>
      </div>
      <div className="ws-event-head-actions flex shrink-0 items-center gap-2">
        {error ? <span className="ws-inline-error text-[var(--type-helper)]">{error}</span> : null}
        {onPreviewCheckout ? (
          <button type="button" className="ws-secondary-btn" onClick={onPreviewCheckout}>
            Preview checkout
          </button>
        ) : null}
        {saved && !saving ? (
          <span className="flex items-center gap-1 text-[var(--type-helper)] text-[var(--state-success)]" role="status">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Saved
          </span>
        ) : null}
        <button type="button" className="appt-pilot-primary-btn" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </header>
  );
}
