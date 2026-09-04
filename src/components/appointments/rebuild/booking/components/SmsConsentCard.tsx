"use client";

import { MessageSquareText, HelpCircle, Check } from "lucide-react";

export default function SmsConsentCard({
  consentText,
  termsUrl,
  privacyUrl,
  saving,
  saved,
  onChange,
  onSave,
}: {
  consentText: string;
  termsUrl: string;
  privacyUrl: string;
  saving: boolean;
  saved: boolean;
  onChange: (patch: { consentText?: string; termsUrl?: string; privacyUrl?: string }) => void;
  onSave: () => void;
}) {
  return (
    <div className="booking-card">
      <div className="flex items-start gap-3">
        <div className="card-icon">
          <MessageSquareText className="h-4 w-4" strokeWidth={1.9} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">SMS consent &amp; legal links</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Collect consent and provide required legal information.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label className="field-label flex items-center gap-1.5" htmlFor="consent-text">
          SMS consent wording
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />
        </label>
        <textarea
          id="consent-text"
          className="field-input h-auto min-h-[64px] resize-none py-2.5 leading-relaxed"
          value={consentText}
          onChange={(e) => onChange({ consentText: e.target.value })}
        />
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          Displayed next to the SMS opt-in checkbox on your public booking page.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="terms-url">
            Terms of service URL
          </label>
          <input
            id="terms-url"
            className="field-input"
            value={termsUrl}
            onChange={(e) => onChange({ termsUrl: e.target.value })}
            placeholder="/terms"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="privacy-url">
            Privacy policy URL
          </label>
          <input
            id="privacy-url"
            className="field-input"
            value={privacyUrl}
            onChange={(e) => onChange({ privacyUrl: e.target.value })}
            placeholder="/privacy"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
        <button className="btn-primary" type="button" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save consent settings"}
        </button>
      </div>
    </div>
  );
}
