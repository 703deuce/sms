"use client";

import React from "react";
import { MessageSquare, Check } from "lucide-react";

type SmsConsent = {
  wording: string;
  termsUrl: string;
  privacyUrl: string;
};

type Props = {
  smsConsent: SmsConsent;
  saving: boolean;
  saved: boolean;
  onFieldChange: (field: keyof SmsConsent, value: string) => void;
  onSave: () => void;
};

export default function SmsConsentCard({
  smsConsent,
  saving,
  saved,
  onFieldChange,
  onSave,
}: Props) {
  return (
    <section className="bk-card" aria-labelledby="bk-consent-title">
      <h2 id="bk-consent-title" className="bk-card-title">
        <MessageSquare size={15} className="text-blue-600" strokeWidth={2} />
        SMS consent
      </h2>
      <p className="bk-card-desc">
        This wording appears next to the SMS consent checkbox on your booking
        page. The checkbox is always unchecked by default so customers make an
        affirmative choice.
      </p>

      <div className="bk-field">
        <label className="bk-label" htmlFor="bk-consent-text">
          Consent wording
        </label>
        <textarea
          id="bk-consent-text"
          className="bk-textarea"
          value={smsConsent.wording}
          onChange={(e) => onFieldChange("wording", e.target.value)}
        />
        <p className="bk-hint">
          Keep the sender name, message frequency, rates notice, and STOP
          opt-out language intact to remain compliant.
        </p>
      </div>

      <div className="bk-row">
        <div className="bk-field">
          <label className="bk-label" htmlFor="bk-terms-url">
            Terms URL
          </label>
          <input
            id="bk-terms-url"
            type="url"
            className="bk-input"
            value={smsConsent.termsUrl}
            onChange={(e) => onFieldChange("termsUrl", e.target.value)}
          />
        </div>
        <div className="bk-field">
          <label className="bk-label" htmlFor="bk-privacy-url">
            Privacy URL
          </label>
          <input
            id="bk-privacy-url"
            type="url"
            className="bk-input"
            value={smsConsent.privacyUrl}
            onChange={(e) => onFieldChange("privacyUrl", e.target.value)}
          />
        </div>
      </div>

      <div className="bk-card-actions">
        {saved && (
          <span className="bk-saved-note" role="status">
            <Check size={13} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
